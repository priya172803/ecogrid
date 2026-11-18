import type {
  ConsumerCategory,
  TariffCalculationInput,
  TariffCalculationResult,
  TariffPolicy,
  TariffSlabBreakdown,
} from '../types/energy';

export const STATE_DISCOM_OPTIONS: Record<string, string[]> = {
  Karnataka: ['BESCOM', 'MESCOM', 'HESCOM', 'GESCOM', 'CESC Mysore'],
  Maharashtra: ['MSEDCL (Mahavitaran)', 'Tata Power', 'Adani Electricity Mumbai', 'BEST'],
  Delhi: ['BSES Rajdhani', 'BSES Yamuna', 'Tata Power-DDL'],
  'Tamil Nadu': ['TANGEDCO (TNEB)'],
  Gujarat: ['UGVCL', 'MGVCL', 'DGVCL', 'PGVCL', 'Torrent Power'],
  Kerala: ['KSEB'],
  Telangana: ['TSSPDCL', 'TSNPDCL'],
  'Uttar Pradesh': ['UPPCL', 'NPCL'],
  'West Bengal': ['WBSEDCL', 'CESC Kolkata'],
};

export const DEFAULT_TARIFF_POLICIES: TariffPolicy[] = [
  // Karnataka Defaults
  {
    id: 'karnataka_domestic',
    state: 'Karnataka',
    category: 'domestic',
    discom: 'BESCOM',
    fixedChargePerMonth: 115,
    demandChargePerKva: 0,
    taxRatePercent: 9,
    carbonTaxThresholdKwh: 300,
    carbonTaxRatePerKwh: 0.75,
    peakHourSurchargePercent: 18,
    offPeakRebatePercent: 12,
    subsidyUnitsLimit: 200,
    subsidyDiscountPerKwh: 1.5,
    gridEmissionFactorKgPerKwh: 0.76,
    slabs: [
      { upToKwh: 100, ratePerKwh: 4.75 },
      { upToKwh: 200, ratePerKwh: 6.25 },
      { upToKwh: 400, ratePerKwh: 7.4 },
      { upToKwh: 999999, ratePerKwh: 8.6 },
    ],
  },
  {
    id: 'karnataka_commercial',
    state: 'Karnataka',
    category: 'commercial',
    discom: 'BESCOM',
    fixedChargePerMonth: 450,
    demandChargePerKva: 210,
    taxRatePercent: 12,
    carbonTaxThresholdKwh: 1500,
    carbonTaxRatePerKwh: 1.15,
    peakHourSurchargePercent: 25,
    offPeakRebatePercent: 15,
    subsidyUnitsLimit: 0,
    subsidyDiscountPerKwh: 0,
    gridEmissionFactorKgPerKwh: 0.76,
    slabs: [
      { upToKwh: 500, ratePerKwh: 8.15 },
      { upToKwh: 2000, ratePerKwh: 9.25 },
      { upToKwh: 999999, ratePerKwh: 10.4 },
    ],
  },
  {
    id: 'karnataka_industrial',
    state: 'Karnataka',
    category: 'industrial',
    discom: 'BESCOM',
    fixedChargePerMonth: 1200,
    demandChargePerKva: 290,
    taxRatePercent: 10,
    carbonTaxThresholdKwh: 10000,
    carbonTaxRatePerKwh: 1.35,
    peakHourSurchargePercent: 22,
    offPeakRebatePercent: 20,
    subsidyUnitsLimit: 0,
    subsidyDiscountPerKwh: 0,
    gridEmissionFactorKgPerKwh: 0.76,
    slabs: [
      { upToKwh: 5000, ratePerKwh: 7.1 },
      { upToKwh: 20000, ratePerKwh: 7.85 },
      { upToKwh: 999999, ratePerKwh: 8.5 },
    ],
  },
  // National / Generic Baseline Defaults per Category
  {
    id: 'default_domestic',
    state: 'All India Baseline',
    category: 'domestic',
    discom: 'Standard DISCOM',
    fixedChargePerMonth: 110,
    demandChargePerKva: 0,
    taxRatePercent: 8,
    carbonTaxThresholdKwh: 280,
    carbonTaxRatePerKwh: 0.7,
    peakHourSurchargePercent: 15,
    offPeakRebatePercent: 10,
    subsidyUnitsLimit: 150,
    subsidyDiscountPerKwh: 1.25,
    gridEmissionFactorKgPerKwh: 0.82,
    slabs: [
      { upToKwh: 100, ratePerKwh: 4.5 },
      { upToKwh: 300, ratePerKwh: 6.4 },
      { upToKwh: 500, ratePerKwh: 7.8 },
      { upToKwh: 999999, ratePerKwh: 8.9 },
    ],
  },
  {
    id: 'default_commercial',
    state: 'All India Baseline',
    category: 'commercial',
    discom: 'Standard DISCOM',
    fixedChargePerMonth: 420,
    demandChargePerKva: 195,
    taxRatePercent: 12,
    carbonTaxThresholdKwh: 1200,
    carbonTaxRatePerKwh: 1.1,
    peakHourSurchargePercent: 22,
    offPeakRebatePercent: 14,
    subsidyUnitsLimit: 0,
    subsidyDiscountPerKwh: 0,
    gridEmissionFactorKgPerKwh: 0.82,
    slabs: [
      { upToKwh: 500, ratePerKwh: 7.9 },
      { upToKwh: 2000, ratePerKwh: 9.1 },
      { upToKwh: 999999, ratePerKwh: 10.2 },
    ],
  },
  {
    id: 'default_industrial',
    state: 'All India Baseline',
    category: 'industrial',
    discom: 'Standard DISCOM',
    fixedChargePerMonth: 1150,
    demandChargePerKva: 275,
    taxRatePercent: 10,
    carbonTaxThresholdKwh: 8000,
    carbonTaxRatePerKwh: 1.3,
    peakHourSurchargePercent: 20,
    offPeakRebatePercent: 18,
    subsidyUnitsLimit: 0,
    subsidyDiscountPerKwh: 0,
    gridEmissionFactorKgPerKwh: 0.82,
    slabs: [
      { upToKwh: 5000, ratePerKwh: 6.95 },
      { upToKwh: 20000, ratePerKwh: 7.7 },
      { upToKwh: 999999, ratePerKwh: 8.4 },
    ],
  },
];

export function resolveTariffPolicy(
  category: ConsumerCategory,
  state: string,
  discom?: string,
  livePolicies: TariffPolicy[] = []
): TariffPolicy {
  const allPolicies = [...livePolicies, ...DEFAULT_TARIFF_POLICIES];

  // Exact match: state + discom + category
  if (discom) {
    const exact = allPolicies.find(
      (p) =>
        p.category === category &&
        p.state.toLowerCase() === state.toLowerCase() &&
        p.discom.toLowerCase() === discom.toLowerCase()
    );
    if (exact) return exact;
  }

  // State + category match
  const stateMatch = allPolicies.find(
    (p) => p.category === category && p.state.toLowerCase() === state.toLowerCase()
  );
  if (stateMatch) return stateMatch;

  // Category default
  const catDefault = allPolicies.find(
    (p) => p.category === category && p.state === 'All India Baseline'
  );
  return catDefault || DEFAULT_TARIFF_POLICIES[3];
}

export function calculateDynamicTariff(
  input: TariffCalculationInput,
  livePolicies: TariffPolicy[] = []
): TariffCalculationResult {
  const policy =
    input.customPolicy ||
    resolveTariffPolicy(input.category, input.state, input.discom, livePolicies);

  const totalKwh = Math.max(0, Number(input.kwh) || 0);
  const sortedSlabs = [...policy.slabs].sort((a, b) => a.upToKwh - b.upToKwh);

  const slabBreakdown: TariffSlabBreakdown[] = [];
  let remaining = totalKwh;
  let prevCap = 0;
  let baseEnergyCharge = 0;

  for (const slab of sortedSlabs) {
    if (remaining <= 0) break;
    const span = slab.upToKwh >= 999999 ? remaining : Math.max(0, slab.upToKwh - prevCap);
    const unitsInSlab = Math.min(remaining, span);
    const amount = unitsInSlab * slab.ratePerKwh;
    const label =
      slab.upToKwh >= 999999
        ? `Above ${prevCap} kWh`
        : `${prevCap + 1}–${slab.upToKwh} kWh`;

    if (unitsInSlab > 0) {
      slabBreakdown.push({
        label,
        units: Number(unitsInSlab.toFixed(2)),
        ratePerKwh: slab.ratePerKwh,
        amount: Number(amount.toFixed(2)),
      });
    }

    baseEnergyCharge += amount;
    remaining -= unitsInSlab;
    prevCap = slab.upToKwh;
  }

  const clampedPeak = Math.max(0, Math.min(1, input.peakShareRatio));
  const clampedOffPeak = Math.max(0, Math.min(1 - clampedPeak, input.offPeakShareRatio));

  const peakSurcharge =
    baseEnergyCharge * clampedPeak * (policy.peakHourSurchargePercent / 100);
  const offPeakRebate =
    baseEnergyCharge * clampedOffPeak * (policy.offPeakRebatePercent / 100);

  const fixedCharge = policy.fixedChargePerMonth;
  const demandKva =
    input.category === 'domestic'
      ? 0
      : Math.max(0, input.contractDemandKva || (input.category === 'commercial' ? 15 : 80));
  const demandCharge = demandKva * policy.demandChargePerKva;

  // Power factor penalty/incentive for industrial consumers (baseline 0.95)
  let powerFactorAdjustment = 0;
  if (input.category === 'industrial' && typeof input.powerFactor === 'number') {
    const pf = Math.max(0.5, Math.min(1.0, input.powerFactor));
    if (pf < 0.9) {
      // 1% penalty per 0.01 below 0.90
      powerFactorAdjustment = baseEnergyCharge * ((0.9 - pf) * 100 * 0.01);
    } else if (pf >= 0.97) {
      // 2% incentive for high power factor
      powerFactorAdjustment = -baseEnergyCharge * 0.02;
    }
  }

  // Subsidies (typically domestic lifeline)
  const subsidizedUnits = Math.min(totalKwh, policy.subsidyUnitsLimit);
  const subsidyCredit = subsidizedUnits * policy.subsidyDiscountPerKwh;

  // Rooftop solar net-metering offset credit (~110 kWh/kW/month generation credit)
  const solarKw = Math.max(0, input.solarCapacityKw || 0);
  const solarOffsetKwh = Math.min(totalKwh, solarKw * 110);
  const solarOffsetCredit = solarOffsetKwh * 3.2;

  // Dynamic Carbon Tax on excess consumption above policy threshold
  const excessCarbonKwh = Math.max(0, totalKwh - policy.carbonTaxThresholdKwh);
  const dynamicCarbonTax = excessCarbonKwh * policy.carbonTaxRatePerKwh;

  const taxableBase = Math.max(
    0,
    baseEnergyCharge + peakSurcharge - offPeakRebate + fixedCharge + demandCharge + powerFactorAdjustment
  );
  const electricityDutyTax = taxableBase * (policy.taxRatePercent / 100);

  const voucherDiscount = Math.max(0, input.appliedDiscountInr || 0);

  const totalPayableInr = Math.max(
    0,
    taxableBase +
      electricityDutyTax +
      dynamicCarbonTax -
      subsidyCredit -
      solarOffsetCredit -
      voucherDiscount
  );

  const netGridKwh = Math.max(0, totalKwh - solarOffsetKwh);
  const carbonEmissionKg = netGridKwh * policy.gridEmissionFactorKgPerKwh;

  return {
    policyUsed: policy,
    totalKwh: Number(totalKwh.toFixed(2)),
    slabBreakdown,
    baseEnergyCharge: Number(baseEnergyCharge.toFixed(2)),
    peakSurcharge: Number(peakSurcharge.toFixed(2)),
    offPeakRebate: Number(offPeakRebate.toFixed(2)),
    fixedCharge: Number(fixedCharge.toFixed(2)),
    demandCharge: Number(demandCharge.toFixed(2)),
    powerFactorAdjustment: Number(powerFactorAdjustment.toFixed(2)),
    electricityDutyTax: Number(electricityDutyTax.toFixed(2)),
    dynamicCarbonTax: Number(dynamicCarbonTax.toFixed(2)),
    subsidyCredit: Number(subsidyCredit.toFixed(2)),
    solarOffsetCredit: Number(solarOffsetCredit.toFixed(2)),
    voucherDiscount: Number(voucherDiscount.toFixed(2)),
    totalPayableInr: Number(totalPayableInr.toFixed(2)),
    effectiveRatePerKwh: totalKwh > 0 ? Number((totalPayableInr / totalKwh).toFixed(2)) : 0,
    carbonEmissionKg: Number(carbonEmissionKg.toFixed(2)),
  };
}
