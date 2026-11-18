import type { ConsumerCategory, EnergyRecord, OffsetRewardItem, UserProfile } from '../types/energy';

export const CATEGORY_BENCHMARK_KWH: Record<ConsumerCategory, number> = {
  domestic: 290,
  commercial: 1450,
  industrial: 9500,
};

export const OFFSET_CATALOG: OffsetRewardItem[] = [
  {
    id: 'solar_microgrid_50',
    title: 'Rural Solar Microgrid Offset (50 kg CO₂e)',
    description: 'Funds 50 kg CO₂e clean displacement via verified decentralized solar microgrids.',
    rewardType: 'carbon_offset',
    pointsCost: 200,
    carbonOffsetKg: 50,
    discountInr: 0,
    partnerProgram: 'National Clean Microgrid Registry',
  },
  {
    id: 'mangrove_sink_120',
    title: 'Coastal Mangrove Carbon Sink (120 kg CO₂e)',
    description: 'Retires 120 kg CO₂e through audited blue-carbon mangrove restoration.',
    rewardType: 'carbon_offset',
    pointsCost: 420,
    carbonOffsetKg: 120,
    discountInr: 0,
    partnerProgram: 'Blue Carbon India Trust',
  },
  {
    id: 'wind_rec_300',
    title: 'Utility Wind Renewable Certificate (300 kg CO₂e)',
    description: 'Offsets 300 kg CO₂e equivalent grid emissions with wind energy certificates.',
    rewardType: 'carbon_offset',
    pointsCost: 900,
    carbonOffsetKg: 300,
    discountInr: 0,
    partnerProgram: 'Green Energy Corridor REC',
  },
  {
    id: 'offpeak_rebate_150',
    title: '₹150 Off-Peak Tariff Rebate Voucher',
    description: 'Applies a ₹150 credit directly against your dynamic electricity & peak surcharge bill.',
    rewardType: 'bill_discount',
    pointsCost: 300,
    carbonOffsetKg: 0,
    discountInr: 150,
    partnerProgram: 'DISCOM Dynamic Tariff Rebate Pool',
  },
  {
    id: 'carbon_tax_waiver_450',
    title: '₹450 Eco-Tax & Carbon Surcharge Waiver',
    description: 'Waives up to ₹450 in dynamic carbon taxation or excess slab charges.',
    rewardType: 'bill_discount',
    pointsCost: 750,
    carbonOffsetKg: 0,
    discountInr: 450,
    partnerProgram: 'Dynamic Green Taxation Credit',
  },
];

export interface EarnedPointsBreakdown {
  reductionPoints: number;
  offPeakPoints: number;
  cleanEnergyPoints: number;
  consistencyPoints: number;
  totalEarnedPoints: number;
  energySavingScore: number; // 0..100
  reductionPercentVsBenchmark: number;
}

export function calculateEarnedGreenPoints(
  currentMonthKwh: number,
  previousMonthKwh: number,
  records: EnergyRecord[],
  profile: UserProfile
): EarnedPointsBreakdown {
  const benchmark = CATEGORY_BENCHMARK_KWH[profile.category];
  const referenceKwh = previousMonthKwh > 0 ? previousMonthKwh : benchmark;

  const reductionPercentVsBenchmark =
    referenceKwh > 0 ? ((referenceKwh - currentMonthKwh) / referenceKwh) * 100 : 0;

  // 10 points per 1% reduction vs reference (capped at 350 pts/cycle)
  const reductionPoints =
    reductionPercentVsBenchmark > 0
      ? Math.min(350, Math.round(reductionPercentVsBenchmark * 10))
      : 0;

  // +2 pts per kWh logged in off-peak hours (capped at 250)
  const offPeakKwh = records
    .filter((r) => r.peakType === 'off_peak')
    .reduce((sum, r) => sum + r.kwh, 0);
  const offPeakPoints = Math.min(250, Math.round(offPeakKwh * 2));

  // Solar / clean power bonus
  const solarKw =
    profile.category === 'domestic'
      ? profile.domesticProfile?.solarCapacityKw || 0
      : profile.category === 'industrial'
      ? profile.industrialProfile?.solarCapacityKw || 0
      : 0;
  const cleanEnergyPoints = solarKw > 0 ? Math.min(200, Math.round(solarKw * 40)) : 0;

  // Consistency bonus for tracking records
  const consistencyPoints = Math.min(100, records.length * 10);

  const totalEarnedPoints =
    reductionPoints + offPeakPoints + cleanEnergyPoints + consistencyPoints;

  // Energy-saving score 0..100
  const offPeakRatio =
    records.length > 0
      ? offPeakKwh / Math.max(1, records.reduce((s, r) => s + r.kwh, 0))
      : 0.2;
  const baseScore = 58 + Math.max(-20, Math.min(25, reductionPercentVsBenchmark)) + offPeakRatio * 20 + (solarKw > 0 ? 8 : 0);
  const energySavingScore = Math.max(15, Math.min(99, Math.round(baseScore)));

  return {
    reductionPoints,
    offPeakPoints,
    cleanEnergyPoints,
    consistencyPoints,
    totalEarnedPoints,
    energySavingScore,
    reductionPercentVsBenchmark: Number(reductionPercentVsBenchmark.toFixed(1)),
  };
}
