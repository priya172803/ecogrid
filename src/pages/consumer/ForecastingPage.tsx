import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock, Info, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { buildDashboardSnapshot } from '../../utils/dashboardMetrics';
import { buildDemoEnergyRecords } from '../../utils/demoData';

export function ForecastingPage() {
  const { profile, energyRecords, bills, tariffPolicies, useDemoPreview, setUseDemoPreview } = useAuth();
  const [horizon, setHorizon] = useState<'7d' | '30d' | 'monthly'>('7d');

  const hasLive = energyRecords.length > 0 || bills.length > 0;

  const recordsToUse = useMemo(() => {
    if (!profile) return [];
    if (hasLive && !useDemoPreview) return energyRecords;
    if (useDemoPreview) {
      return buildDemoEnergyRecords(profile.uid, profile.category, profile.state, profile.discom);
    }
    return [];
  }, [profile, energyRecords, hasLive, useDemoPreview]);

  const forecast = useMemo(() => {
    if (!profile) return null;
    return buildDashboardSnapshot(
      profile,
      recordsToUse,
      tariffPolicies,
      !hasLive || useDemoPreview,
      useDemoPreview ? [] : bills
    ).forecast;
  }, [recordsToUse, profile, tariffPolicies, hasLive, useDemoPreview, bills]);

  if (!profile || !forecast) return null;

  const chartData =
    horizon === '7d'
      ? forecast.daily7Day
      : horizon === '30d'
      ? forecast.daily30Day
      : forecast.monthly3Month;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Statistical Demand Projection</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-700">
              {useDemoPreview ? 'DEMO DATA' : forecast.hasSufficientData ? 'LIVE USER DATA' : 'BASELINE ESTIMATE'}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Energy Demand &amp; Bill Forecasting
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setUseDemoPreview(!useDemoPreview)}
            className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer"
          >
            {useDemoPreview ? 'Use My Live Records' : 'Simulate with Demo History'}
          </button>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: '7d' as const, label: '7-Day' },
              { id: '30d' as const, label: '30-Day' },
              { id: 'monthly' as const, label: 'Monthly' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setHorizon(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  horizon === t.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transparency & Data Sufficiency Notice */}
      <div
        className={`rounded-xl border p-4 flex items-start gap-3 ${
          forecast.hasSufficientData
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/70 border-amber-200 text-amber-950'
        }`}
      >
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed space-y-1">
          <p className="font-semibold">{forecast.dataQualityMessage}</p>
          <p className="text-slate-700">
            <span className="font-medium">Transparent Algorithm: </span>
            {forecast.algorithmSummary}
          </p>
        </div>
      </div>

      {/* Forecast Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Upcoming 7-Day Demand</p>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {forecast.sevenDayTotalKwh.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Short-term operational window</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Next 30-Day Expected Usage</p>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {forecast.nextMonthKwh.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            Range: {forecast.nextMonthLowerKwh.toLocaleString()}–{forecast.nextMonthUpperKwh.toLocaleString()} kWh
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Predicted Monthly Bill</p>
          <p className="font-mono text-2xl font-bold text-emerald-800 tabular-nums mt-1">
            ₹{forecast.nextMonthBillEstimateInr.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">Includes dynamic slabs, duty &amp; carbon tax</p>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {horizon === '7d'
                ? '7-Day Demand Projection with Confidence Band'
                : horizon === '30d'
                ? '30-Day Demand Projection with Confidence Band'
                : '3-Month Seasonal Energy Projection'}
            </h2>
            <p className="text-xs text-slate-500">
              Shaded envelope represents ±1 historical standard deviation confidence bounds
            </p>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-700" />
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="upperBoundKwh"
                name="Upper Bound (kWh)"
                stroke="none"
                fill="#d1fae5"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="predictedKwh"
                name="Predicted Demand (kWh)"
                stroke="#065f46"
                fill="#10b981"
                fillOpacity={0.25}
                strokeWidth={2.5}
              />
              <Area
                type="monotone"
                dataKey="lowerBoundKwh"
                name="Lower Bound (kWh)"
                stroke="#6ee7b7"
                fill="#ffffff"
                fillOpacity={0.8}
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Likely Peak Windows & Breakdown Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-700">
            <Clock className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-slate-900">Likely Peak Consumption Periods</h3>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-700">
            {forecast.likelyPeakWindows.map((win, idx) => (
              <li key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                {win}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Projected Horizon Breakdown
          </h3>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 px-3 font-medium">Period</th>
                  <th className="py-2 px-3 font-medium text-right">Predicted (kWh)</th>
                  <th className="py-2 px-3 font-medium text-right">Confidence Range</th>
                  <th className="py-2 px-3 font-medium text-right">Est. Cost (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chartData.map((row) => (
                  <tr key={row.label} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-900">{row.label}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">
                      {row.predictedKwh.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">
                      {row.lowerBoundKwh}–{row.upperBoundKwh}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-800 font-medium">
                      ₹{row.predictedCostInr.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
