import type {
  ElectricityBill,
  EnergyRecord,
  ForecastResult,
  TariffCalculationResult,
  TariffPolicy,
  UserProfile,
} from '../types/energy';
import { calculateEarnedGreenPoints, type EarnedPointsBreakdown } from './carbonRewards';
import { generateEnergyForecast } from './forecasting';
import { calculateDynamicTariff } from './tariffEngine';

export interface DashboardSnapshot {
  isDemoData: boolean;
  recordsUsed: EnergyRecord[];
  verifiedBillCount: number;
  latestBill: ElectricityBill | null;
  currentMonthKwh: number;
  previousMonthKwh: number;
  consumptionChangePercent: number;
  averageMonthlyKwh: number;
  currentMonthActualBillInr: number | null;
  previousMonthBillInr: number | null;
  billAmountChangePercent: number | null;
  averageMonthlyBillInr: number;
  estimatedBill: TariffCalculationResult;
  carbonEmissionKg: number;
  peakHourKwh: number;
  peakSharePercent: number;
  offPeakKwh: number;
  offPeakSharePercent: number;
  earnedPoints: EarnedPointsBreakdown;
  forecast: ForecastResult;
  monthlyChartData: {
    month: string;
    kwh: number;
    costInr: number;
    carbonKg: number;
  }[];
  dailyChartData: {
    date: string;
    peakKwh: number;
    offPeakKwh: number;
    normalKwh: number;
    totalKwh: number;
  }[];
  peakVsOffPeakChartData: {
    period: string;
    kwh: number;
    sharePercent: number;
  }[];
}

const MONTH_NAME_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

export function resolveBillMonthKey(bill: ElectricityBill): string {
  const candidates = [bill.billingMonth, bill.billDate, bill.billIssueDate, bill.billingPeriodEnd, bill.billingPeriod];
  for (const raw of candidates) {
    if (!raw) continue;
    const str = raw.trim();
    const ymMatch = str.match(/(\d{4})[-/](\d{1,2})/);
    if (ymMatch) {
      return `${ymMatch[1]}-${ymMatch[2].padStart(2, '0')}`;
    }
    const nameMatch = str.match(/([a-zA-Z]{3,9})[\s,-]+(\d{4})/);
    if (nameMatch) {
      const m = MONTH_NAME_MAP[nameMatch[1].toLowerCase()];
      if (m) return `${nameMatch[2]}-${m}`;
    }
  }
  return new Date().toISOString().slice(0, 7);
}

export function buildDashboardSnapshot(
  profile: UserProfile,
  records: EnergyRecord[],
  livePolicies: TariffPolicy[],
  isDemoData: boolean,
  bills: ElectricityBill[] = []
): DashboardSnapshot {
  const activeBills = isDemoData ? [] : bills.filter((b) => b.verifiedByUser !== false);

  // Merge confirmed bills into monthly buckets alongside EnergyRecords
  const billMonthMap = new Map<
    string,
    { kwh: number; amountInr: number; bill: ElectricityBill }
  >();
  for (const b of activeBills) {
    const ym = resolveBillMonthKey(b);
    const kwh = Number(b.unitsConsumed ?? b.totalConsumptionKwh ?? 0);
    const existing = billMonthMap.get(ym);
    if (!existing) {
      billMonthMap.set(ym, { kwh, amountInr: Number(b.totalBillAmount || 0), bill: b });
    } else {
      billMonthMap.set(ym, {
        kwh: existing.kwh + kwh,
        amountInr: existing.amountInr + Number(b.totalBillAmount || 0),
        bill: b,
      });
    }
  }

  // Synthesize monthly records for any verified bills that weren't already synced as EnergyRecords
  const existingBillSyncKeys = new Set(
    records
      .filter((r) => r.source === 'bill_sync')
      .map((r) => `${r.date.slice(0, 7)}:${Math.round(r.kwh)}`)
  );

  const syntheticBillRecords: EnergyRecord[] = [];
  for (const [ym, info] of billMonthMap.entries()) {
    if (info.kwh > 0 && !existingBillSyncKeys.has(`${ym}:${Math.round(info.kwh)}`)) {
      syntheticBillRecords.push({
        id: `bill_virtual_${info.bill.id}`,
        userId: profile.uid,
        category: profile.category,
        granularity: 'monthly',
        date: `${ym}-01`,
        kwh: info.kwh,
        timePeriod: info.bill.billingMonth || info.bill.billingPeriod || ym,
        peakType: 'normal',
        estimatedCostInr: info.amountInr,
        carbonKg: 0,
        source: 'bill_sync',
        notes: `Verified Bill: ${info.bill.fileName}`,
      });
    }
  }

  const sorted = [...records, ...syntheticBillRecords].sort((a, b) => a.date.localeCompare(b.date));

  // Group all records by YYYY-MM
  const monthBuckets = new Map<
    string,
    { monthlySum: number; dailySum: number; costSum: number; carbonSum: number }
  >();
  for (const r of sorted) {
    const ym = r.date.slice(0, 7);
    const curr = monthBuckets.get(ym) || { monthlySum: 0, dailySum: 0, costSum: 0, carbonSum: 0 };
    if (r.granularity === 'monthly') {
      curr.monthlySum += r.kwh;
    } else {
      curr.dailySum += r.kwh;
    }
    curr.costSum += r.estimatedCostInr;
    curr.carbonSum += r.carbonKg;
    monthBuckets.set(ym, curr);
  }

  const monthKeys = Array.from(monthBuckets.keys()).sort();
  const getMonthKwh = (ym: string) => {
    const billInfo = billMonthMap.get(ym);
    if (billInfo && billInfo.kwh > 0) return billInfo.kwh;
    const b = monthBuckets.get(ym);
    if (!b) return 0;
    return b.monthlySum > 0 ? b.monthlySum : b.dailySum;
  };

  const latestMonthKey = monthKeys[monthKeys.length - 1];
  const prevMonthKey = monthKeys.length >= 2 ? monthKeys[monthKeys.length - 2] : undefined;

  const currentMonthKwh = Number((latestMonthKey ? getMonthKwh(latestMonthKey) : 0).toFixed(1));
  const sortedBills = [...activeBills].sort((a, b) =>
    resolveBillMonthKey(a).localeCompare(resolveBillMonthKey(b))
  );
  const latestBill = sortedBills.length > 0 ? sortedBills[sortedBills.length - 1] : null;

  let previousMonthKwh = Number((prevMonthKey ? getMonthKwh(prevMonthKey) : 0).toFixed(1));
  if (previousMonthKwh === 0 && latestBill) {
    const billPrev = Number(
      latestBill.previousMonthConsumption ?? latestBill.previousMonthConsumptionKwh ?? 0
    );
    if (billPrev > 0) previousMonthKwh = Number(billPrev.toFixed(1));
  }

  const consumptionChangePercent =
    previousMonthKwh > 0
      ? Number((((currentMonthKwh - previousMonthKwh) / previousMonthKwh) * 100).toFixed(1))
      : 0;

  // Peak / Off-Peak calculation
  const peakHourKwh = Number(
    sorted
      .filter((r) => r.peakType === 'peak')
      .reduce((s, r) => s + r.kwh, 0)
      .toFixed(1)
  );
  const offPeakKwh = Number(
    sorted
      .filter((r) => r.peakType === 'off_peak')
      .reduce((s, r) => s + r.kwh, 0)
      .toFixed(1)
  );
  const normalKwh = Number(
    sorted
      .filter((r) => r.peakType === 'normal')
      .reduce((s, r) => s + r.kwh, 0)
      .toFixed(1)
  );
  const totalTyped = Math.max(1, peakHourKwh + offPeakKwh + normalKwh);
  const peakShareRatio = peakHourKwh > 0 ? peakHourKwh / totalTyped : 0.32;
  const offPeakShareRatio = offPeakKwh > 0 ? offPeakKwh / totalTyped : 0.2;

  const estimatedBill = calculateDynamicTariff(
    {
      kwh: currentMonthKwh,
      category: profile.category,
      state: profile.state,
      discom: profile.discom,
      peakShareRatio,
      offPeakShareRatio,
      contractDemandKva:
        profile.category === 'commercial'
          ? profile.commercialProfile?.sanctionedLoadKw
          : profile.industrialProfile?.contractDemandKva,
      powerFactor: profile.industrialProfile?.powerFactor,
      solarCapacityKw:
        profile.category === 'domestic'
          ? profile.domesticProfile?.solarCapacityKw
          : profile.industrialProfile?.solarCapacityKw,
    },
    livePolicies
  );

  const monthlyChartData = monthKeys.slice(-8).map((ym) => {
    const kwh = Number(getMonthKwh(ym).toFixed(1));
    const tariff = calculateDynamicTariff(
      {
        kwh,
        category: profile.category,
        state: profile.state,
        discom: profile.discom,
        peakShareRatio,
        offPeakShareRatio,
        solarCapacityKw:
          profile.category === 'domestic'
            ? profile.domesticProfile?.solarCapacityKw
            : profile.industrialProfile?.solarCapacityKw,
      },
      livePolicies
    );
    const verifiedBillInfo = billMonthMap.get(ym);
    const costInr =
      verifiedBillInfo && verifiedBillInfo.amountInr > 0
        ? verifiedBillInfo.amountInr
        : tariff.totalPayableInr;

    const [yr, mo] = ym.split('-');
    const dt = new Date(Number(yr), Number(mo) - 1, 1);
    return {
      month: Number.isNaN(dt.getTime())
        ? ym
        : dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      kwh,
      costInr,
      carbonKg: tariff.carbonEmissionKg,
    };
  });

  const currentMonthActualBillInr =
    latestMonthKey && billMonthMap.get(latestMonthKey)?.amountInr
      ? Number(billMonthMap.get(latestMonthKey)!.amountInr.toFixed(2))
      : null;

  const previousMonthBillInr =
    prevMonthKey && billMonthMap.get(prevMonthKey)?.amountInr
      ? Number(billMonthMap.get(prevMonthKey)!.amountInr.toFixed(2))
      : null;

  const billAmountChangePercent =
    currentMonthActualBillInr !== null &&
    previousMonthBillInr !== null &&
    previousMonthBillInr > 0
      ? Number(
          (((currentMonthActualBillInr - previousMonthBillInr) / previousMonthBillInr) * 100).toFixed(1)
        )
      : null;

  const averageMonthlyKwh =
    monthlyChartData.length > 0
      ? Number(
          (
            monthlyChartData.reduce((sum, item) => sum + item.kwh, 0) / monthlyChartData.length
          ).toFixed(1)
        )
      : 0;

  const averageMonthlyBillInr =
    monthlyChartData.length > 0
      ? Number(
          (
            monthlyChartData.reduce((sum, item) => sum + item.costInr, 0) / monthlyChartData.length
          ).toFixed(0)
        )
      : 0;

  // Daily Usage Chart (last 14 daily/hourly entries grouped by date)
  const dailyMap = new Map<
    string,
    { peakKwh: number; offPeakKwh: number; normalKwh: number; totalKwh: number }
  >();
  for (const r of sorted.filter((rec) => rec.granularity !== 'monthly')) {
    const entry = dailyMap.get(r.date) || {
      peakKwh: 0,
      offPeakKwh: 0,
      normalKwh: 0,
      totalKwh: 0,
    };
    if (r.peakType === 'peak') entry.peakKwh += r.kwh;
    else if (r.peakType === 'off_peak') entry.offPeakKwh += r.kwh;
    else entry.normalKwh += r.kwh;
    entry.totalKwh += r.kwh;
    dailyMap.set(r.date, entry);
  }
  const dailyChartData = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, val]) => ({
      date: date.slice(5),
      peakKwh: Number(val.peakKwh.toFixed(1)),
      offPeakKwh: Number(val.offPeakKwh.toFixed(1)),
      normalKwh: Number(val.normalKwh.toFixed(1)),
      totalKwh: Number(val.totalKwh.toFixed(1)),
    }));

  const peakVsOffPeakChartData = [
    {
      period: 'Peak Hours',
      kwh: peakHourKwh,
      sharePercent: Number(((peakHourKwh / totalTyped) * 100).toFixed(1)),
    },
    {
      period: 'Off-Peak Hours',
      kwh: offPeakKwh,
      sharePercent: Number(((offPeakKwh / totalTyped) * 100).toFixed(1)),
    },
    {
      period: 'Normal Hours',
      kwh: normalKwh,
      sharePercent: Number(((normalKwh / totalTyped) * 100).toFixed(1)),
    },
  ];

  const earnedPoints = calculateEarnedGreenPoints(
    currentMonthKwh,
    previousMonthKwh,
    sorted,
    profile
  );

  const forecast = generateEnergyForecast(sorted, profile, livePolicies);

  return {
    isDemoData,
    recordsUsed: sorted,
    verifiedBillCount: activeBills.length,
    latestBill,
    currentMonthKwh,
    previousMonthKwh,
    consumptionChangePercent,
    averageMonthlyKwh,
    currentMonthActualBillInr,
    previousMonthBillInr,
    billAmountChangePercent,
    averageMonthlyBillInr,
    estimatedBill,
    carbonEmissionKg: estimatedBill.carbonEmissionKg,
    peakHourKwh,
    peakSharePercent: Number((peakShareRatio * 100).toFixed(1)),
    offPeakKwh,
    offPeakSharePercent: Number((offPeakShareRatio * 100).toFixed(1)),
    earnedPoints,
    forecast,
    monthlyChartData,
    dailyChartData,
    peakVsOffPeakChartData,
  };
}
