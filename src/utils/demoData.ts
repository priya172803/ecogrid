import type { ConsumerCategory, EnergyRecord } from '../types/energy';
import { calculateDynamicTariff } from './tariffEngine';

export function buildDemoEnergyRecords(
  userId: string,
  category: ConsumerCategory,
  state: string,
  discom: string
): EnergyRecord[] {
  const scale = category === 'domestic' ? 1 : category === 'commercial' ? 5.2 : 34;
  const records: EnergyRecord[] = [];
  const today = new Date();

  // 6 monthly historical records
  const monthlyKwhPattern = [310, 295, 330, 348, 318, 286];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const kwh = Math.round(monthlyKwhPattern[5 - i] * scale);
    const tariff = calculateDynamicTariff({
      kwh,
      category,
      state,
      discom,
      peakShareRatio: 0.34,
      offPeakShareRatio: 0.22,
    });
    records.push({
      id: `demo_m_${i}`,
      userId,
      category,
      granularity: 'monthly',
      date: dateStr,
      kwh,
      timePeriod: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      peakType: 'normal',
      estimatedCostInr: tariff.totalPayableInr,
      carbonKg: tariff.carbonEmissionKg,
      source: 'manual',
      notes: 'DEMO DATA · Monthly historical baseline',
    });
  }

  // 14 daily records for current window (split across peak & off-peak)
  const dailyPattern = [9.2, 10.4, 8.7, 11.1, 10.8, 12.3, 11.6, 9.5, 8.9, 10.1, 9.4, 8.6, 11.4, 9.1];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const kwh = Number((dailyPattern[13 - i] * scale).toFixed(1));
    const peakType = i % 3 === 0 ? 'peak' : i % 2 === 0 ? 'off_peak' : 'normal';
    const rate = category === 'domestic' ? 6.6 : category === 'commercial' ? 9.1 : 7.8;

    records.push({
      id: `demo_d_${i}`,
      userId,
      category,
      granularity: 'daily',
      date: dateStr,
      kwh,
      timePeriod: peakType === 'peak' ? '18:00–22:00' : peakType === 'off_peak' ? '23:00–05:00' : 'Full Day',
      peakType,
      estimatedCostInr: Number((kwh * rate).toFixed(1)),
      carbonKg: Number((kwh * 0.78).toFixed(1)),
      source: 'manual',
      notes: 'DEMO DATA · Daily usage sample',
    });
  }

  return records;
}
