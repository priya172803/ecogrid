import React, { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ConsumerCategory } from '../../types/energy';
import { calculateDynamicTariff, STATE_DISCOM_OPTIONS } from '../../utils/tariffEngine';

export function TariffSimulatorPage() {
  const { profile, tariffPolicies } = useAuth();

  const [category, setCategory] = useState<ConsumerCategory>(profile?.category || 'domestic');
  const [state, setState] = useState(profile?.state || 'Karnataka');
  const [discom, setDiscom] = useState(profile?.discom || 'BESCOM');
  const [kwh, setKwh] = useState(
    profile?.category === 'industrial' ? 12000 : profile?.category === 'commercial' ? 1800 : 340
  );
  const [peakPercent, setPeakPercent] = useState(35);
  const [offPeakPercent, setOffPeakPercent] = useState(20);
  const [contractDemandKva, setContractDemandKva] = useState(
    profile?.industrialProfile?.contractDemandKva ||
      profile?.commercialProfile?.sanctionedLoadKw ||
      20
  );
  const [powerFactor, setPowerFactor] = useState(profile?.industrialProfile?.powerFactor || 0.94);
  const [solarKw, setSolarKw] = useState(
    profile?.domesticProfile?.solarCapacityKw || profile?.industrialProfile?.solarCapacityKw || 0
  );
  const [voucherDiscount, setVoucherDiscount] = useState(0);

  const discoms = STATE_DISCOM_OPTIONS[state] || ['Standard DISCOM'];

  const result = useMemo(() => {
    return calculateDynamicTariff(
      {
        kwh,
        category,
        state,
        discom,
        peakShareRatio: peakPercent / 100,
        offPeakShareRatio: offPeakPercent / 100,
        contractDemandKva,
        powerFactor,
        solarCapacityKw: solarKw,
        appliedDiscountInr: voucherDiscount,
      },
      tariffPolicies
    );
  }, [
    kwh,
    category,
    state,
    discom,
    peakPercent,
    offPeakPercent,
    contractDemandKva,
    powerFactor,
    solarKw,
    voucherDiscount,
    tariffPolicies,
  ]);

  // What-if comparison: shifting 50% of peak hours to off-peak hours
  const shiftedResult = useMemo(() => {
    const shiftedAmount = Math.round(peakPercent * 0.5);
    return calculateDynamicTariff(
      {
        kwh,
        category,
        state,
        discom,
        peakShareRatio: (peakPercent - shiftedAmount) / 100,
        offPeakShareRatio: Math.min(100, offPeakPercent + shiftedAmount) / 100,
        contractDemandKva,
        powerFactor,
        solarCapacityKw: solarKw,
        appliedDiscountInr: voucherDiscount,
      },
      tariffPolicies
    );
  }, [
    kwh,
    category,
    state,
    discom,
    peakPercent,
    offPeakPercent,
    contractDemandKva,
    powerFactor,
    solarKw,
    voucherDiscount,
    tariffPolicies,
  ]);

  const potentialShiftingSavings = Math.max(
    0,
    Number((result.totalPayableInr - shiftedResult.totalPayableInr).toFixed(2))
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Dynamic Electricity Tariff &amp; Taxation Engine
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Interactive 10-factor tariff calculator modeling progressive slabs, Time-of-Day surcharges/rebates, demand charges, power factor adjustments, subsidies, and dynamic carbon taxation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-800 pb-2 border-b border-slate-200">
            <Calculator className="w-4 h-4" />
            <h2 className="text-sm font-semibold text-slate-900">Tariff Parameters</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
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
            <div>
              <label className="block font-medium text-slate-700 mb-1">State</label>
              <select
                value={state}
                onChange={(e) => {
                  const st = e.target.value;
                  setState(st);
                  setDiscom((STATE_DISCOM_OPTIONS[st] || ['Standard DISCOM'])[0]);
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
            <div className="col-span-2">
              <label className="block font-medium text-slate-700 mb-1">DISCOM Provider</label>
              <select
                value={discom}
                onChange={(e) => setDiscom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {discoms.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-700">Monthly Consumption</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">{kwh} kWh</span>
            </div>
            <input
              type="range"
              min={20}
              max={category === 'industrial' ? 30000 : category === 'commercial' ? 6000 : 1200}
              step={10}
              value={kwh}
              onChange={(e) => setKwh(Number(e.target.value))}
              className="w-full accent-emerald-700"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-700">Peak-Hour Usage Share</span>
              <span className="font-mono font-semibold text-amber-700 tabular-nums">{peakPercent}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={80}
              value={peakPercent}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPeakPercent(v);
                if (v + offPeakPercent > 100) setOffPeakPercent(100 - v);
              }}
              className="w-full accent-amber-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-700">Off-Peak Usage Share</span>
              <span className="font-mono font-semibold text-emerald-700 tabular-nums">{offPeakPercent}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100 - peakPercent}
              value={offPeakPercent}
              onChange={(e) => setOffPeakPercent(Number(e.target.value))}
              className="w-full accent-emerald-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-2">
            {category !== 'domestic' && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">Contract Demand (kVA)</label>
                <input
                  type="number"
                  min={1}
                  value={contractDemandKva}
                  onChange={(e) => setContractDemandKva(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            )}
            {category === 'industrial' && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">Power Factor</label>
                <input
                  type="number"
                  min={0.5}
                  max={1.0}
                  step="0.01"
                  value={powerFactor}
                  onChange={(e) => setPowerFactor(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            )}
            <div>
              <label className="block font-medium text-slate-700 mb-1">Rooftop Solar (kW)</label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={solarKw}
                onChange={(e) => setSolarKw(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Green Voucher (₹)</label>
              <input
                type="number"
                min={0}
                step="50"
                value={voucherDiscount}
                onChange={(e) => setVoucherDiscount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Output Breakdown */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs text-slate-500">
                  Policy Applied: {result.policyUsed.state} · {result.policyUsed.discom} · {result.policyUsed.category}
                </p>
                <h2 className="font-display text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                  ₹{result.totalPayableInr.toLocaleString()}
                </h2>
              </div>
              <div className="text-xs text-slate-600 font-mono tabular-nums sm:text-right">
                <p>Effective Rate: ₹{result.effectiveRatePerKwh}/kWh</p>
                <p>Emissions: {result.carbonEmissionKg} kg CO₂e</p>
              </div>
            </div>

            {/* Slab Breakdown */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 mb-2">Progressive Slab Charges</h3>
              <div className="space-y-1.5 text-xs">
                {result.slabBreakdown.map((s) => (
                  <div key={s.label} className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">
                      {s.label} ({s.units} kWh × ₹{s.ratePerKwh})
                    </span>
                    <span className="font-mono tabular-nums text-slate-900">₹{s.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Modifiers & Taxes */}
            <div className="space-y-1.5 text-xs pt-2">
              <h3 className="text-xs font-semibold text-slate-900 mb-2">
                Time-of-Day, Demand, Carbon Tax &amp; Subsidies
              </h3>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Fixed Monthly Charge</span>
                <span className="font-mono tabular-nums">+₹{result.fixedCharge}</span>
              </div>
              {result.demandCharge > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Contract Demand Charge ({contractDemandKva} kVA)</span>
                  <span className="font-mono tabular-nums">+₹{result.demandCharge.toLocaleString()}</span>
                </div>
              )}
              {result.powerFactorAdjustment !== 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Power Factor Adjustment (PF {powerFactor})</span>
                  <span className="font-mono tabular-nums">
                    {result.powerFactorAdjustment > 0 ? `+₹${result.powerFactorAdjustment}` : `-₹${Math.abs(result.powerFactorAdjustment)}`}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 text-amber-800">
                <span>Peak-Hour Surcharge (+{result.policyUsed.peakHourSurchargePercent}%)</span>
                <span className="font-mono tabular-nums">+₹{result.peakSurcharge}</span>
              </div>
              <div className="flex justify-between py-1 text-emerald-800">
                <span>Off-Peak Rebate (-{result.policyUsed.offPeakRebatePercent}%)</span>
                <span className="font-mono tabular-nums">-₹{result.offPeakRebate}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Electricity Duty ({result.policyUsed.taxRatePercent}%)</span>
                <span className="font-mono tabular-nums">+₹{result.electricityDutyTax}</span>
              </div>
              <div className="flex justify-between py-1 text-amber-900">
                <span>
                  Dynamic Carbon Tax (above {result.policyUsed.carbonTaxThresholdKwh} kWh @ ₹{result.policyUsed.carbonTaxRatePerKwh}/kWh)
                </span>
                <span className="font-mono tabular-nums">+₹{result.dynamicCarbonTax}</span>
              </div>
              {result.subsidyCredit > 0 && (
                <div className="flex justify-between py-1 text-emerald-800">
                  <span>Lifeline Subsidy Credit</span>
                  <span className="font-mono tabular-nums">-₹{result.subsidyCredit}</span>
                </div>
              )}
              {result.solarOffsetCredit > 0 && (
                <div className="flex justify-between py-1 text-emerald-800">
                  <span>Solar Net-Metering Credit ({solarKw} kW)</span>
                  <span className="font-mono tabular-nums">-₹{result.solarOffsetCredit}</span>
                </div>
              )}
              {result.voucherDiscount > 0 && (
                <div className="flex justify-between py-1 text-emerald-800">
                  <span>Green Voucher Redemption Credit</span>
                  <span className="font-mono tabular-nums">-₹{result.voucherDiscount}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950">
              <span className="font-semibold">Load-Shifting Simulation: </span>
              Shifting half of your peak-hour consumption to off-peak hours reduces your estimated bill by{' '}
              <span className="font-mono font-bold">₹{potentialShiftingSavings.toLocaleString()}/month</span>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
