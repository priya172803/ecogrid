import React, { useMemo, useState } from 'react';
import { PlusCircle, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ConsumerCategory, GranularityType, PeakClassification } from '../../types/energy';
import { calculateDynamicTariff } from '../../utils/tariffEngine';

export function ManualEntryPage() {
  const { profile, tariffPolicies, addEnergyRecord } = useAuth();

  const [granularity, setGranularity] = useState<GranularityType>('daily');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [kwh, setKwh] = useState('12.5');
  const [category, setCategory] = useState<ConsumerCategory>(profile?.category || 'domestic');
  const [timePeriod, setTimePeriod] = useState('18:00–22:00');
  const [peakType, setPeakType] = useState<PeakClassification>('peak');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const previewCalc = useMemo(() => {
    if (!profile) return null;
    const numericKwh = Math.max(0, Number(kwh) || 0);
    return calculateDynamicTariff(
      {
        kwh: numericKwh,
        category,
        state: profile.state,
        discom: profile.discom,
        peakShareRatio: peakType === 'peak' ? 1 : 0,
        offPeakShareRatio: peakType === 'off_peak' ? 1 : 0,
      },
      tariffPolicies
    );
  }, [kwh, category, peakType, profile, tariffPolicies]);

  const handleGranularityChange = (g: GranularityType) => {
    setGranularity(g);
    if (g === 'hourly') setTimePeriod('19:00–20:00');
    else if (g === 'daily') setTimePeriod('Full Day');
    else setTimePeriod(new Date(date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericKwh = Number(kwh);
    if (!Number.isFinite(numericKwh) || numericKwh < 0) return;
    setSubmitting(true);
    try {
      await addEnergyRecord({
        category,
        granularity,
        date,
        kwh: numericKwh,
        timePeriod,
        peakType,
        notes,
        source: 'manual',
      });
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Manual Energy Consumption Entry
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Log hourly, daily, or monthly historical electricity consumption directly into Cloud Firestore without physical smart meters.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Entry Granularity
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg">
              {(['hourly', 'daily', 'monthly'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => handleGranularityChange(g)}
                  className={`py-2 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                    granularity === g
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {g} Usage
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date (Historical or Current) *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Consumption (kWh) *
              </label>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={kwh}
                onChange={(e) => setKwh(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Consumer Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ConsumerCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="domestic">Domestic / Household</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Peak / Off-Peak Classification
              </label>
              <select
                value={peakType}
                onChange={(e) => setPeakType(e.target.value as PeakClassification)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="peak">Peak Hours (ToD Surcharge)</option>
                <option value="normal">Normal Hours</option>
                <option value="off_peak">Off-Peak Hours (ToD Rebate + Bonus Pts)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Time Period / Billing Window
              </label>
              <input
                type="text"
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                placeholder="e.g., 18:00–22:00, Full Day, or Oct 2026"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Notes (Appliances / Shift / Observations)
              </label>
              <textarea
                rows={2}
                maxLength={300}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Heavy AC usage during afternoon peak or Shift 2 CNC load"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 text-white text-sm font-medium rounded-lg hover:bg-emerald-900 disabled:opacity-50 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            {submitting ? 'Saving Entry...' : 'Save Consumption Record'}
          </button>
        </form>

        {/* Live Tariff & Carbon Impact Preview */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-800">
            <Zap className="w-4 h-4" />
            <h2 className="text-sm font-semibold text-slate-900">Instant Impact Preview</h2>
          </div>
          {previewCalc && (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Entered Energy</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {previewCalc.totalKwh} kWh
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Est. Energy Cost</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  ₹{granularity === 'monthly'
                    ? previewCalc.totalPayableInr.toLocaleString()
                    : (previewCalc.totalKwh * (previewCalc.effectiveRatePerKwh || 7)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Carbon Footprint</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {previewCalc.carbonEmissionKg} kg CO₂e
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">ToD Adjustment</span>
                <span className="font-mono font-medium text-slate-800">
                  {peakType === 'peak'
                    ? `+${previewCalc.policyUsed.peakHourSurchargePercent}% Peak`
                    : peakType === 'off_peak'
                    ? `-${previewCalc.policyUsed.offPeakRebatePercent}% Rebate`
                    : 'Standard Rate'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
