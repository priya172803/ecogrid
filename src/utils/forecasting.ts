import type {
  EnergyRecord,
  ForecastPoint,
  ForecastResult,
  TariffPolicy,
  UserProfile,
} from '../types/energy';
import { calculateDynamicTariff } from './tariffEngine';

function getProfileBaselineDailyKwh(profile: UserProfile): number {
  if (profile.category === 'domestic') {
    const dp = profile.domesticProfile;
    if (!dp) return 11;
    const base = 3.5 + dp.householdSize * 1.4 + dp.wfhMembers * 1.2 + dp.hvacUsageHours * 1.1;
    const applianceLoad = (dp.appliances?.length || 2) * 0.65;
    const solarOffset = (dp.solarCapacityKw || 0) * 3.5;
    return Math.max(3, base + applianceLoad - solarOffset);
  }
  if (profile.category === 'commercial') {
    const cp = profile.commercialProfile;
    if (!cp) return 68;
    const areaFactor = (cp.floorAreaSqFt || 1800) / 120;
    const loadFactor = (cp.sanctionedLoadKw || 15) * 2.4;
    const daysFactor = (cp.operatingDaysPerWeek || 6) / 6;
    return Math.max(15, (areaFactor + loadFactor) * daysFactor);
  }
  const ip = profile.industrialProfile;
  if (!ip) return 420;
  const shiftFactor = (ip.shiftsPerDay || 2) * 145;
  const demandFactor = (ip.contractDemandKva || 80) * 2.2;
  const solarOffset = (ip.solarCapacityKw || 0) * 3.2;
  return Math.max(60, shiftFactor + demandFactor - solarOffset);
}

function getProfilePeakWindows(profile: UserProfile): string[] {
  if (profile.category === 'domestic') {
    const hvac = profile.domesticProfile?.hvacUsageHours || 4;
    return hvac >= 6
      ? ['18:00 – 22:30 (Evening HVAC & Lighting Peak)', '13:00 – 16:00 (Afternoon Cooling)']
      : ['18:30 – 22:00 (Evening Residential Peak)', '07:00 – 09:00 (Morning Geyser/Kitchen)'];
  }
  if (profile.category === 'commercial') {
    const open = profile.commercialProfile?.openTime || '09:00';
    const close = profile.commercialProfile?.closeTime || '20:00';
    return [
      `11:00 – 16:30 (Midday HVAC & Occupancy Peak within ${open}–${close})`,
      '18:00 – 20:30 (Grid Peak Overlap)',
    ];
  }
  const shifts = profile.industrialProfile?.shiftsPerDay || 2;
  return shifts === 3
    ? ['18:00 – 22:00 (Evening Utility ToD Peak Shift)', '10:00 – 13:00 (High-Torque Process Peak)']
    : ['09:30 – 13:30 (Shift 1 Process Load)', '18:00 – 21:30 (Shift 2 Peak Overlap)'];
}

export function generateEnergyForecast(
  records: EnergyRecord[],
  profile: UserProfile,
  livePolicies: TariffPolicy[] = []
): ForecastResult {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const dailySeries = sorted.filter((r) => r.granularity === 'daily' || r.granularity === 'hourly');
  const monthlySeries = sorted.filter((r) => r.granularity === 'monthly');

  // Aggregate daily records by date
  const dailyMap = new Map<string, number>();
  for (const r of dailySeries) {
    dailyMap.set(r.date, (dailyMap.get(r.date) || 0) + r.kwh);
  }
  const dailyValues = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, kwh]) => kwh);

  const hasSufficientData = dailyValues.length >= 5 || monthlySeries.length >= 3;
  const profileBaselineDaily = getProfileBaselineDailyKwh(profile);

  // Derive daily baseline via Weighted Moving Average + OLS Trend when data is available
  let baseDaily = profileBaselineDaily;
  let dailySlope = 0;
  let stdDev = profileBaselineDaily * 0.14;

  if (dailyValues.length >= 3) {
    const recent = dailyValues.slice(-14);
    let weightSum = 0;
    let weightedTotal = 0;
    recent.forEach((val, idx) => {
      const w = idx + 1; // Linearly increasing recency weight
      weightedTotal += val * w;
      weightSum += w;
    });
    const wma = weightedTotal / weightSum;

    // Simple OLS linear slope over recent window
    const n = recent.length;
    const xMean = (n - 1) / 2;
    const yMean = recent.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let den = 0;
    recent.forEach((y, x) => {
      num += (x - xMean) * (y - yMean);
      den += (x - xMean) * (x - xMean);
    });
    const rawSlope = den > 0 ? num / den : 0;
    // Clamp daily drift to avoid runaway extrapolation
    dailySlope = Math.max(-wma * 0.03, Math.min(wma * 0.03, rawSlope));
    baseDaily = wma;

    const variance = recent.reduce((acc, v) => acc + Math.pow(v - yMean, 2), 0) / n;
    stdDev = Math.max(wma * 0.08, Math.sqrt(variance));
  } else if (monthlySeries.length >= 1) {
    const recentMonths = monthlySeries.slice(-6).map((m) => m.kwh / 30);
    const avgDailyFromMonths = recentMonths.reduce((s, v) => s + v, 0) / recentMonths.length;
    baseDaily = avgDailyFromMonths;
    stdDev = avgDailyFromMonths * 0.12;
  }

  // Seasonal day-of-week multiplier tailored by consumer category
  const getDayMultiplier = (dayOfWeek: number): number => {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (profile.category === 'domestic') {
      return isWeekend ? 1.12 : 0.96;
    }
    if (profile.category === 'commercial') {
      const days = profile.commercialProfile?.operatingDaysPerWeek || 6;
      if (dayOfWeek === 0 && days < 7) return 0.35;
      return isWeekend ? 0.85 : 1.06;
    }
    const shifts = profile.industrialProfile?.shiftsPerDay || 2;
    if (shifts === 3) return 1.0;
    return dayOfWeek === 0 ? 0.45 : 1.05;
  };

  const today = new Date();
  const buildDailyPoints = (horizonDays: number): ForecastPoint[] => {
    const pts: ForecastPoint[] = [];
    for (let i = 1; i <= horizonDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const mult = getDayMultiplier(d.getDay());
      const trendAdjusted = Math.max(1, (baseDaily + dailySlope * i) * mult);
      const margin = stdDev * (1 + i * 0.015);
      const lower = Math.max(0, trendAdjusted - margin);
      const upper = trendAdjusted + margin;
      const estRate = profile.category === 'domestic' ? 6.8 : profile.category === 'commercial' ? 9.1 : 7.8;

      pts.push({
        label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        actualKwh: null,
        predictedKwh: Number(trendAdjusted.toFixed(1)),
        lowerBoundKwh: Number(lower.toFixed(1)),
        upperBoundKwh: Number(upper.toFixed(1)),
        predictedCostInr: Number((trendAdjusted * estRate).toFixed(0)),
        isPeakRisk: trendAdjusted > baseDaily * 1.08,
      });
    }
    return pts;
  };

  const daily7Day = buildDailyPoints(7);
  const daily30Day = buildDailyPoints(30);

  const sevenDayTotalKwh = Number(
    daily7Day.reduce((sum, p) => sum + p.predictedKwh, 0).toFixed(1)
  );
  const nextMonthKwh = Number(
    daily30Day.reduce((sum, p) => sum + p.predictedKwh, 0).toFixed(1)
  );
  const nextMonthLowerKwh = Number(
    daily30Day.reduce((sum, p) => sum + p.lowerBoundKwh, 0).toFixed(1)
  );
  const nextMonthUpperKwh = Number(
    daily30Day.reduce((sum, p) => sum + p.upperBoundKwh, 0).toFixed(1)
  );

  // Estimate next month's bill using Dynamic Tariff Engine
  const tariffEstimate = calculateDynamicTariff(
    {
      kwh: nextMonthKwh,
      category: profile.category,
      state: profile.state,
      discom: profile.discom,
      peakShareRatio: profile.category === 'domestic' ? 0.34 : 0.42,
      offPeakShareRatio: profile.category === 'industrial' ? 0.25 : 0.18,
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

  // Build Monthly 3-Month Horizon (includes up to 3 recent actual months if available)
  const monthly3Month: ForecastPoint[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let m = 1; m <= 3; m++) {
    const targetMonthIdx = (today.getMonth() + m) % 12;
    // Gentle seasonal temperature uplift for summer/peak months
    const seasonalFactor = [3, 4, 5, 9].includes(targetMonthIdx) ? 1.08 : 0.98;
    const predicted = Number((nextMonthKwh * seasonalFactor * (1 + (dailySlope * 15 * m) / Math.max(1, baseDaily * 30))).toFixed(0));
    const margin = Number(((nextMonthUpperKwh - nextMonthLowerKwh) * 0.55 * (1 + m * 0.1)).toFixed(0));
    const billRes = calculateDynamicTariff(
      {
        kwh: predicted,
        category: profile.category,
        state: profile.state,
        discom: profile.discom,
        peakShareRatio: 0.35,
        offPeakShareRatio: 0.2,
      },
      livePolicies
    );
    monthly3Month.push({
      label: `${monthNames[targetMonthIdx]} Forecast`,
      actualKwh: null,
      predictedKwh: predicted,
      lowerBoundKwh: Math.max(0, predicted - margin),
      upperBoundKwh: predicted + margin,
      predictedCostInr: billRes.totalPayableInr,
      isPeakRisk: seasonalFactor > 1.0,
    });
  }

  const dataQualityMessage = hasSufficientData
    ? `Calculated from ${records.length} recorded energy entries using recency-weighted moving averages, OLS linear drift, and your ${profile.category} load profile.`
    : `Insufficient personal history (${records.length} entries found; ≥ 5 daily or ≥ 3 monthly logs recommended). Showing a transparent Baseline Estimate derived from your ${profile.category} profile attributes (${profileBaselineDaily.toFixed(1)} kWh/day baseline).`;

  return {
    hasSufficientData,
    dataPointsUsed: records.length,
    dataQualityMessage,
    algorithmSummary:
      'Recency-Weighted Moving Average (WMA) + Ordinary Least Squares (OLS) Trend Slope + Category Day-of-Week Seasonality + Profile Load Adjustment.',
    nextMonthKwh,
    nextMonthLowerKwh,
    nextMonthUpperKwh,
    nextMonthBillEstimateInr: tariffEstimate.totalPayableInr,
    sevenDayTotalKwh,
    likelyPeakWindows: getProfilePeakWindows(profile),
    daily7Day,
    daily30Day,
    monthly3Month,
  };
}
