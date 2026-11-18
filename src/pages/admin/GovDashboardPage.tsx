import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2, IndianRupee, Leaf, ShieldCheck, Users, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { calculateDynamicTariff } from '../../utils/tariffEngine';

export function GovDashboardPage() {
  const {
    allConsumerSummaries,
    allRecordsAdmin,
    tariffPolicies,
    advisories,
  } = useAuth();

  const analytics = useMemo(() => {
    const hasLiveAggregates = allRecordsAdmin.length > 0;

    if (hasLiveAggregates) {
      const catTotals: Record<'domestic' | 'commercial' | 'industrial', { kwh: number; tax: number; carbon: number }> = {
        domestic: { kwh: 0, tax: 0, carbon: 0 },
        commercial: { kwh: 0, tax: 0, carbon: 0 },
        industrial: { kwh: 0, tax: 0, carbon: 0 },
      };
      for (const rec of allRecordsAdmin) {
        catTotals[rec.category].kwh += rec.kwh;
        catTotals[rec.category].carbon += rec.carbonKg;
        const tariff = calculateDynamicTariff(
          {
            kwh: rec.kwh,
            category: rec.category,
            state: 'Karnataka',
            peakShareRatio: rec.peakType === 'peak' ? 1 : 0.3,
            offPeakShareRatio: rec.peakType === 'off_peak' ? 1 : 0.2,
          },
          tariffPolicies
        );
        catTotals[rec.category].tax += tariff.dynamicCarbonTax + tariff.electricityDutyTax;
      }

      const totalKwh = Object.values(catTotals).reduce((s, c) => s + c.kwh, 0);
      const totalCarbon = Object.values(catTotals).reduce((s, c) => s + c.carbon, 0);
      const totalTax = Object.values(catTotals).reduce((s, c) => s + c.tax, 0);
      const totalOffsets = allConsumerSummaries.reduce((s, u) => s + (u.totalCarbonOffsetKg || 0), 0);

      return {
        isLive: true,
        totalConsumers: allConsumerSummaries.length,
        totalKwh: Math.round(totalKwh),
        totalCarbon: Math.round(totalCarbon),
        totalTax: Math.round(totalTax),
        totalOffsets: Math.round(totalOffsets),
        categoryChart: [
          { category: 'Domestic', kwh: Math.round(catTotals.domestic.kwh), taxInr: Math.round(catTotals.domestic.tax), carbonKg: Math.round(catTotals.domestic.carbon) },
          { category: 'Commercial', kwh: Math.round(catTotals.commercial.kwh), taxInr: Math.round(catTotals.commercial.tax), carbonKg: Math.round(catTotals.commercial.carbon) },
          { category: 'Industrial', kwh: Math.round(catTotals.industrial.kwh), taxInr: Math.round(catTotals.industrial.tax), carbonKg: Math.round(catTotals.industrial.carbon) },
        ],
      };
    }

    // Policy simulation fallback when zero consumer logs exist across project yet
    return {
      isLive: false,
      totalConsumers: allConsumerSummaries.length,
      totalKwh: 148200,
      totalCarbon: 114114,
      totalTax: 186450,
      totalOffsets: 14200,
      categoryChart: [
        { category: 'Domestic', kwh: 32400, taxInr: 24800, carbonKg: 24948 },
        { category: 'Commercial', kwh: 48800, taxInr: 68200, carbonKg: 37576 },
        { category: 'Industrial', kwh: 67000, taxInr: 93450, carbonKg: 51590 },
      ],
    };
  }, [allRecordsAdmin, allConsumerSummaries, tariffPolicies]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
            <span>Government Energy Policy &amp; Dynamic Taxation Command</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-700">
              {analytics.isLive ? 'LIVE FIRESTORE AGGREGATE' : 'DEMO GRID BASELINE'}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            National &amp; Regional Grid Policy Monitor
          </h1>
        </div>
        <div className="text-xs text-slate-600 font-mono tabular-nums">
          Active Policies: {tariffPolicies.length} · Advisories: {advisories.length}
        </div>
      </div>

      {/* Policy KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Registered Consumers</span>
            <Users className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {analytics.totalConsumers.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">Across Domestic, Commercial &amp; Industrial</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Tracked Grid Load</span>
            <Zap className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {analytics.totalKwh.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {analytics.isLive ? 'From Firestore energyRecords' : 'DEMO DATA sample telemetry'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Dynamic Tax &amp; Duty Yield</span>
            <IndianRupee className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            ₹{analytics.totalTax.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">Carbon surcharges + electricity duty</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Grid Emissions vs Offsets</span>
            <Leaf className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {analytics.totalCarbon.toLocaleString()} <span className="text-sm font-normal text-slate-500">kg</span>
          </p>
          <p className="text-xs text-emerald-800 mt-1 font-mono tabular-nums">
            {analytics.totalOffsets.toLocaleString()} kg CO₂e offset retired
          </p>
        </div>
      </div>

      {/* Category Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            Consumption Share by Consumer Category (kWh)
          </h2>
          <p className="text-xs text-slate-500 mb-4">Domestic vs Commercial vs Industrial load distribution</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.categoryChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="kwh" name="Consumption (kWh)" radius={[4, 4, 0, 0]}>
                  {analytics.categoryChart.map((entry, idx) => (
                    <Cell key={entry.category} fill={idx === 0 ? '#10b981' : idx === 1 ? '#0f766e' : '#064e3b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            Dynamic Carbon &amp; Electricity Tax Revenue by Sector (₹)
          </h2>
          <p className="text-xs text-slate-500 mb-4">Taxation impact under active slab &amp; threshold policies</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.categoryChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="taxInr" name="Tax Yield (₹)" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Consumer Directory Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-emerald-700" />
          <h2 className="font-display text-base font-semibold text-slate-900">
            Registered Consumer Profiles ({allConsumerSummaries.length})
          </h2>
        </div>
        {allConsumerSummaries.length === 0 ? (
          <p className="text-xs text-slate-500">No registered consumer accounts indexed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Consumer Name</th>
                  <th className="py-2.5 pr-4 font-medium">Category</th>
                  <th className="py-2.5 pr-4 font-medium">State · DISCOM</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Green Points</th>
                  <th className="py-2.5 font-medium text-right">Offsets Retired (kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allConsumerSummaries.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium text-slate-900">{u.fullName}</td>
                    <td className="py-3 pr-4 capitalize text-slate-700">{u.category}</td>
                    <td className="py-3 pr-4 text-slate-600">{u.state} · {u.discom}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-slate-900">
                      {u.rewardPointsBalance?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums text-emerald-800">
                      {u.totalCarbonOffsetKg?.toLocaleString() || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
