import React, { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ConsumerCategory, TariffSlab } from '../../types/energy';
import { DEFAULT_TARIFF_POLICIES, STATE_DISCOM_OPTIONS } from '../../utils/tariffEngine';

export function TariffPolicyManagerPage() {
  const { tariffPolicies, upsertTariffPolicy, deleteTariffPolicy } = useAuth();

  const [state, setState] = useState('Karnataka');
  const [category, setCategory] = useState<ConsumerCategory>('domestic');
  const [discom, setDiscom] = useState('BESCOM');
  const [fixedChargePerMonth, setFixedChargePerMonth] = useState(115);
  const [demandChargePerKva, setDemandChargePerKva] = useState(0);
  const [taxRatePercent, setTaxRatePercent] = useState(9);
  const [carbonTaxThresholdKwh, setCarbonTaxThresholdKwh] = useState(300);
  const [carbonTaxRatePerKwh, setCarbonTaxRatePerKwh] = useState(0.75);
  const [peakHourSurchargePercent, setPeakHourSurchargePercent] = useState(18);
  const [offPeakRebatePercent, setOffPeakRebatePercent] = useState(12);
  const [subsidyUnitsLimit, setSubsidyUnitsLimit] = useState(200);
  const [subsidyDiscountPerKwh, setSubsidyDiscountPerKwh] = useState(1.5);
  const [gridEmissionFactorKgPerKwh, setGridEmissionFactorKgPerKwh] = useState(0.76);
  const [slabs, setSlabs] = useState<TariffSlab[]>([
    { upToKwh: 100, ratePerKwh: 4.75 },
    { upToKwh: 200, ratePerKwh: 6.25 },
    { upToKwh: 400, ratePerKwh: 7.4 },
    { upToKwh: 999999, ratePerKwh: 8.6 },
  ]);
  const [saving, setSaving] = useState(false);

  const loadTemplate = (p: typeof DEFAULT_TARIFF_POLICIES[0]) => {
    setState(p.state);
    setCategory(p.category);
    setDiscom(p.discom);
    setFixedChargePerMonth(p.fixedChargePerMonth);
    setDemandChargePerKva(p.demandChargePerKva);
    setTaxRatePercent(p.taxRatePercent);
    setCarbonTaxThresholdKwh(p.carbonTaxThresholdKwh);
    setCarbonTaxRatePerKwh(p.carbonTaxRatePerKwh);
    setPeakHourSurchargePercent(p.peakHourSurchargePercent);
    setOffPeakRebatePercent(p.offPeakRebatePercent);
    setSubsidyUnitsLimit(p.subsidyUnitsLimit);
    setSubsidyDiscountPerKwh(p.subsidyDiscountPerKwh);
    setGridEmissionFactorKgPerKwh(p.gridEmissionFactorKgPerKwh);
    setSlabs([...p.slabs]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const policyId = `${state.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${discom
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')}_${category}`;
      await upsertTariffPolicy({
        id: policyId,
        state,
        category,
        discom,
        fixedChargePerMonth,
        demandChargePerKva,
        taxRatePercent,
        carbonTaxThresholdKwh,
        carbonTaxRatePerKwh,
        peakHourSurchargePercent,
        offPeakRebatePercent,
        subsidyUnitsLimit,
        subsidyDiscountPerKwh,
        gridEmissionFactorKgPerKwh,
        slabs,
      });
    } finally {
      setSaving(false);
    }
  };

  const availableDiscoms = STATE_DISCOM_OPTIONS[state] || ['Standard DISCOM'];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Dynamic Tariff &amp; Carbon Taxation Rule Manager
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Publish live slab rates, Time-of-Day peak surcharges, carbon taxation thresholds, and subsidies directly to Firestore. Changes immediately apply across the Consumer Portal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5 text-xs"
        >
          <h2 className="font-display text-base font-semibold text-slate-900">
            Configure &amp; Publish Tariff Rule
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">State</label>
              <select
                value={state}
                onChange={(e) => {
                  const s = e.target.value;
                  setState(s);
                  setDiscom((STATE_DISCOM_OPTIONS[s] || ['Standard DISCOM'])[0]);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {Object.keys(STATE_DISCOM_OPTIONS).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">DISCOM</label>
              <select
                value={availableDiscoms.includes(discom) ? discom : availableDiscoms[0]}
                onChange={(e) => setDiscom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {availableDiscoms.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ConsumerCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="domestic">Domestic</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Fixed Charge (₹/mo)</label>
              <input
                type="number"
                min={0}
                value={fixedChargePerMonth}
                onChange={(e) => setFixedChargePerMonth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Demand Charge (₹/kVA)</label>
              <input
                type="number"
                min={0}
                value={demandChargePerKva}
                onChange={(e) => setDemandChargePerKva(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Electricity Duty (%)</label>
              <input
                type="number"
                min={0}
                max={50}
                step="0.5"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Carbon Tax Threshold (kWh)</label>
              <input
                type="number"
                min={0}
                value={carbonTaxThresholdKwh}
                onChange={(e) => setCarbonTaxThresholdKwh(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Carbon Tax Rate (₹/kWh)</label>
              <input
                type="number"
                min={0}
                step="0.05"
                value={carbonTaxRatePerKwh}
                onChange={(e) => setCarbonTaxRatePerKwh(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Grid Emission (kg CO₂/kWh)</label>
              <input
                type="number"
                min={0.05}
                max={2.5}
                step="0.01"
                value={gridEmissionFactorKgPerKwh}
                onChange={(e) => setGridEmissionFactorKgPerKwh(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Peak Surcharge (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={peakHourSurchargePercent}
                onChange={(e) => setPeakHourSurchargePercent(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Off-Peak Rebate (%)</label>
              <input
                type="number"
                min={0}
                max={50}
                value={offPeakRebatePercent}
                onChange={(e) => setOffPeakRebatePercent(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Subsidy Units Cap</label>
              <input
                type="number"
                min={0}
                value={subsidyUnitsLimit}
                onChange={(e) => setSubsidyUnitsLimit(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Subsidy Credit (₹/kWh)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={subsidyDiscountPerKwh}
                onChange={(e) => setSubsidyDiscountPerKwh(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>

          {/* Slabs Editor */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Consumption Slabs</span>
              {slabs.length < 8 && (
                <button
                  type="button"
                  onClick={() => setSlabs([...slabs, { upToKwh: 999999, ratePerKwh: 9.0 }])}
                  className="inline-flex items-center gap-1 text-emerald-800 font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Slab
                </button>
              )}
            </div>
            <div className="space-y-2">
              {slabs.map((slab, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2 items-center">
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={slab.upToKwh}
                      onChange={(e) => {
                        const next = [...slabs];
                        next[idx] = { ...slab, upToKwh: Number(e.target.value) };
                        setSlabs(next);
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono tabular-nums"
                      placeholder="Up to kWh (999999 = max)"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={0}
                      step="0.05"
                      value={slab.ratePerKwh}
                      onChange={(e) => {
                        const next = [...slabs];
                        next[idx] = { ...slab, ratePerKwh: Number(e.target.value) };
                        setSlabs(next);
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono tabular-nums"
                      placeholder="Rate ₹/kWh"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={slabs.length <= 1}
                    onClick={() => setSlabs(slabs.filter((_, i) => i !== idx))}
                    className="p-1.5 text-slate-400 hover:text-rose-700 disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 text-white text-xs font-medium rounded-lg hover:bg-emerald-900 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Publishing Policy...' : 'Publish Live Tariff Policy'}
          </button>
        </form>

        {/* Active Firestore Policies + Default Templates */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Live Firestore Policy Overrides ({tariffPolicies.length})
            </h3>
            {tariffPolicies.length === 0 ? (
              <p className="text-xs text-slate-500">
                No custom overrides published yet. Consumers currently use built-in regional defaults.
              </p>
            ) : (
              <div className="space-y-2.5">
                {tariffPolicies.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 capitalize">
                        {p.state} · {p.discom} · {p.category}
                      </p>
                      <p className="text-slate-600 font-mono tabular-nums mt-0.5">
                        Peak +{p.peakHourSurchargePercent}% · Carbon Tax ₹{p.carbonTaxRatePerKwh}/kWh &gt; {p.carbonTaxThresholdKwh} kWh
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => loadTemplate(p)}
                        className="px-2 py-1 text-emerald-800 hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTariffPolicy(p.id)}
                        className="p-1 text-slate-400 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Built-In Regional Templates</h3>
            <div className="space-y-2">
              {DEFAULT_TARIFF_POLICIES.slice(0, 3).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => loadTemplate(tpl)}
                  className="w-full text-left p-2.5 border border-slate-200 rounded-lg hover:border-emerald-700 text-xs cursor-pointer transition-colors"
                >
                  <span className="font-semibold text-slate-900 capitalize">
                    {tpl.state} · {tpl.discom} ({tpl.category})
                  </span>
                  <span className="block text-slate-500 mt-0.5 font-mono tabular-nums">
                    Load into editor →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
