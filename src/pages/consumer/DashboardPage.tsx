import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Clock,
  FileUp,
  IndianRupee,
  Leaf,
  PlusCircle,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { AIInsightsResponse } from '../../types/energy';
import { buildDashboardSnapshot } from '../../utils/dashboardMetrics';
import { buildDemoEnergyRecords } from '../../utils/demoData';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const {
    profile,
    energyRecords,
    bills,
    tariffPolicies,
    advisories,
    useDemoPreview,
    setUseDemoPreview,
  } = useAuth();

  const [aiInsights, setAiInsights] = useState<AIInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');

  const hasLiveUserData = energyRecords.length > 0 || bills.length > 0;
  const showDemo = useDemoPreview || !hasLiveUserData;

  const activeRecords = useMemo(() => {
    if (!profile) return [];
    if (hasLiveUserData && !useDemoPreview) {
      return energyRecords;
    }
    if (useDemoPreview) {
      return buildDemoEnergyRecords(profile.uid, profile.category, profile.state, profile.discom);
    }
    return [];
  }, [profile, energyRecords, hasLiveUserData, useDemoPreview]);

  const snapshot = useMemo(() => {
    if (!profile) return null;
    return buildDashboardSnapshot(
      profile,
      activeRecords,
      tariffPolicies,
      !hasLiveUserData || useDemoPreview,
      useDemoPreview ? [] : bills
    );
  }, [profile, activeRecords, tariffPolicies, hasLiveUserData, useDemoPreview, bills]);

  const relevantAdvisories = useMemo(() => {
    if (!profile) return [];
    return advisories.filter(
      (a) =>
        (a.targetCategory === 'all' || a.targetCategory === profile.category) &&
        (a.targetState === 'All States' ||
          a.targetState.toLowerCase() === profile.state.toLowerCase())
    );
  }, [advisories, profile]);

  const fetchAIInsights = async () => {
    if (!profile || !snapshot) return;
    setInsightsLoading(true);
    setInsightsError('');
    try {
      const dataSourceLabel =
        energyRecords.length > 0 && !useDemoPreview
          ? `LIVE USER DATA (${energyRecords.length} Firestore energy records)`
          : 'DEMO DATA / BASELINE ESTIMATE (Sample energy profile)';

      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: {
            category: profile.category,
            state: profile.state,
            discom: profile.discom,
            domesticProfile: profile.domesticProfile,
            commercialProfile: profile.commercialProfile,
            industrialProfile: profile.industrialProfile,
          },
          metrics: {
            currentMonthKwh: snapshot.currentMonthKwh,
            previousMonthKwh: snapshot.previousMonthKwh,
            changePercent: snapshot.consumptionChangePercent,
            peakHourKwh: snapshot.peakHourKwh,
            peakSharePercent: snapshot.peakSharePercent,
            offPeakSharePercent: snapshot.offPeakSharePercent,
            carbonEmissionKg: snapshot.carbonEmissionKg,
          },
          tariffBreakdown: {
            totalPayableInr: snapshot.estimatedBill.totalPayableInr,
            peakSurcharge: snapshot.estimatedBill.peakSurcharge,
            dynamicCarbonTax: snapshot.estimatedBill.dynamicCarbonTax,
            offPeakRebate: snapshot.estimatedBill.offPeakRebate,
            effectiveRatePerKwh: snapshot.estimatedBill.effectiveRatePerKwh,
          },
          forecast: {
            nextMonthKwh: snapshot.forecast.nextMonthKwh,
            nextMonthBillEstimateInr: snapshot.forecast.nextMonthBillEstimateInr,
            likelyPeakWindows: snapshot.forecast.likelyPeakWindows,
          },
          dataSourceLabel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate AI insights.');
      setAiInsights(json.analysis);
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Unable to reach AI analysis service.');
    } finally {
      setInsightsLoading(false);
    }
  };

  if (!profile || !snapshot) return null;

  const hasRecords = snapshot.recordsUsed.length > 0 || snapshot.verifiedBillCount > 0;

  return (
    <div className="space-y-6">
      {/* Header Context & Data Source Switch */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="capitalize font-medium text-emerald-800">{profile.category} Consumer</span>
            <span aria-hidden="true">·</span>
            <span>{profile.city}, {profile.state}</span>
            <span aria-hidden="true">·</span>
            <span>{profile.discom}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-medium text-slate-700">
              {hasLiveUserData && !useDemoPreview
                ? `LIVE USER DATA${bills.length > 0 ? ` (${bills.length} VERIFIED BILL${bills.length > 1 ? 'S' : ''})` : ''}`
                : useDemoPreview
                ? 'DEMO DATA PREVIEW'
                : 'NO RECORDS YET'}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Energy &amp; Dynamic Taxation Overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setUseDemoPreview(!useDemoPreview)}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              useDemoPreview
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {useDemoPreview ? 'Exit Demo Data Preview' : 'Preview with Demo Data'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('bill-upload')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 text-white text-xs font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileUp className="w-4 h-4" />
            Upload Electricity Bill
          </button>
        </div>
      </div>

      {/* Government Advisories Banner (if active) */}
      {relevantAdvisories.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
          {relevantAdvisories.slice(0, 2).map((adv) => (
            <div key={adv.id} className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-800">
                <span className="font-semibold">{adv.title}</span>
                <span className="text-slate-500 mx-1.5">·</span>
                <span className="text-slate-700">{adv.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State when user has 0 records and demo preview is off */}
      {!hasRecords && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6" />
          </div>
          <div className="max-w-lg mx-auto">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              No electricity consumption records logged yet
            </h2>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Upload your monthly electricity bill for Gemini extraction, enter daily or monthly readings manually, or preview the dashboard with category-adapted DEMO DATA.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('bill-upload')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 text-white text-sm font-medium rounded-lg hover:bg-emerald-900 cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              Upload First Bill
            </button>
            <button
              type="button"
              onClick={() => onNavigate('manual-entry')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-800 text-sm font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Log Manual Usage
            </button>
            <button
              type="button"
              onClick={() => setUseDemoPreview(true)}
              className="px-4 py-2 text-sm font-medium text-emerald-800 hover:underline cursor-pointer"
            >
              Load Sample Demo Data
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Current Month Usage</span>
            <Zap className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {snapshot.currentMonthKwh.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
          </p>
          <div className="flex items-center gap-1.5 text-xs mt-2">
            {snapshot.consumptionChangePercent <= 0 ? (
              <span className="inline-flex items-center gap-0.5 text-emerald-700 font-medium tabular-nums">
                <ArrowDownRight className="w-3.5 h-3.5" />
                {Math.abs(snapshot.consumptionChangePercent)}% lower
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-amber-700 font-medium tabular-nums">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{snapshot.consumptionChangePercent}% higher
              </span>
            )}
            <span className="text-slate-400">vs {snapshot.previousMonthKwh} kWh prev</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>
              {snapshot.currentMonthActualBillInr !== null
                ? 'Verified Latest Bill'
                : 'Estimated Dynamic Bill'}
            </span>
            <IndianRupee className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            ₹{(snapshot.currentMonthActualBillInr ?? snapshot.estimatedBill.totalPayableInr).toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-2 tabular-nums">
            {snapshot.billAmountChangePercent !== null
              ? `${snapshot.billAmountChangePercent >= 0 ? '+' : ''}${snapshot.billAmountChangePercent}% MoM bill vs ₹${snapshot.previousMonthBillInr?.toLocaleString()}`
              : `Effective ₹${snapshot.estimatedBill.effectiveRatePerKwh}/kWh · Carbon Tax ₹${snapshot.estimatedBill.dynamicCarbonTax}`}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Carbon Footprint &amp; Offsets</span>
            <Leaf className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {snapshot.carbonEmissionKg.toLocaleString()} <span className="text-sm font-normal text-slate-500">kg CO₂e</span>
          </p>
          <p className="text-xs text-slate-500 mt-2 tabular-nums">
            Lifetime Offset: {profile.totalCarbonOffsetKg.toLocaleString()} kg CO₂e
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Green Points &amp; Score</span>
            <Award className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {profile.rewardPointsBalance.toLocaleString()} <span className="text-sm font-normal text-slate-500">pts</span>
          </p>
          <p className="text-xs text-slate-500 mt-2 tabular-nums">
            Efficiency Score: {snapshot.earnedPoints.energySavingScore}/100 · +{snapshot.earnedPoints.totalEarnedPoints} earned
          </p>
        </div>
      </div>

      {/* Secondary Operational KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Average Monthly Usage</p>
            <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums mt-0.5">
              {snapshot.averageMonthlyKwh.toLocaleString()} kWh{' '}
              <span className="text-xs font-normal text-slate-500">
                (Avg ₹{snapshot.averageMonthlyBillInr.toLocaleString()})
              </span>
            </p>
          </div>
          <Activity className="w-5 h-5 text-slate-400" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Peak-Hour Consumption Share</p>
            <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums mt-0.5">
              {snapshot.peakSharePercent}% <span className="text-xs font-normal text-slate-500">({snapshot.peakHourKwh} kWh)</span>
            </p>
          </div>
          <Clock className="w-5 h-5 text-amber-600" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Next Month Demand Forecast</p>
            <p className="font-mono text-lg font-semibold text-emerald-800 tabular-nums mt-0.5">
              {snapshot.forecast.nextMonthKwh.toLocaleString()} kWh · ₹{snapshot.forecast.nextMonthBillEstimateInr.toLocaleString()}
            </p>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-700" />
        </div>
      </div>

      {/* Personalized Gemini AI Energy Insight Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Profile-Tailored Energy Intelligence</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-700">
                {showDemo && !hasLiveUserData ? 'DEMO DATA' : useDemoPreview ? 'DEMO DATA' : 'LIVE USER DATA'}
              </span>
            </div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              AI Energy &amp; Dynamic Tariff Recommendations
            </h2>
          </div>
          <button
            type="button"
            disabled={insightsLoading}
            onClick={fetchAIInsights}
            className="px-4 py-2 bg-emerald-800 text-white text-xs font-medium rounded-lg hover:bg-emerald-900 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {insightsLoading ? 'Analyzing Profile & Usage...' : aiInsights ? 'Refresh AI Insights' : 'Generate AI Insights'}
          </button>
        </div>

        {insightsError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 mb-4">
            {insightsError}
          </div>
        )}

        {insightsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-slate-100 rounded-lg" />
            ))}
          </div>
        )}

        {!insightsLoading && !aiInsights && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs font-medium text-slate-500 mb-1">Month-over-Month Delta</p>
              <p className="text-slate-800">
                {snapshot.previousMonthKwh > 0
                  ? `You consumed ${Math.abs(snapshot.consumptionChangePercent)}% ${
                      snapshot.consumptionChangePercent >= 0 ? 'more' : 'less'
                    } electricity this period compared with your previous cycle (${snapshot.previousMonthKwh} kWh).`
                  : 'Log or upload at least two cycles to track month-over-month consumption variance.'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs font-medium text-slate-500 mb-1">Peak-Hour Tariff Impact</p>
              <p className="text-slate-800">
                Peak usage adds ₹{snapshot.estimatedBill.peakSurcharge.toLocaleString()} in ToD surcharge. Shifting 25% of peak load to off-peak hours saves approximately ₹
                {Math.round(snapshot.estimatedBill.peakSurcharge * 0.25 + snapshot.estimatedBill.baseEnergyCharge * 0.04).toLocaleString()}/month.
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs font-medium text-slate-500 mb-1">Category Profile Context</p>
              <p className="text-slate-800">
                {profile.category === 'domestic' &&
                  `Configured for ${profile.domesticProfile?.householdSize || 4} occupants, ${profile.domesticProfile?.hvacUsageHours || 4}h/day AC, and ${profile.domesticProfile?.appliances?.length || 0} tracked appliances.`}
                {profile.category === 'commercial' &&
                  `Configured for ${profile.commercialProfile?.businessType || 'Commercial'} (${profile.commercialProfile?.openTime || '09:00'}–${profile.commercialProfile?.closeTime || '20:00'}, ${profile.commercialProfile?.sanctionedLoadKw || 15} kW sanctioned).`}
                {profile.category === 'industrial' &&
                  `Configured for ${profile.industrialProfile?.industryType || 'Industrial'} (${profile.industrialProfile?.shiftsPerDay || 2} shifts/day, PF ${profile.industrialProfile?.powerFactor || 0.94}, ${profile.industrialProfile?.contractDemandKva || 80} kVA).`}
              </p>
            </div>
          </div>
        )}

        {!insightsLoading && aiInsights && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              {aiInsights.headline}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {aiInsights.insights?.slice(0, 3).map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-900">{item.title}</span>
                    <span className="font-mono capitalize">{item.priority}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>
                  <p className="text-xs font-mono text-emerald-800 tabular-nums pt-1">
                    Est. Save: ₹{item.estimatedMonthlySavingsInr}/mo · -{item.estimatedCarbonReductionKg} kg CO₂e
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700 pt-1">
              <p>
                <span className="font-semibold text-slate-900">Profile Action: </span>
                {aiInsights.profileSpecificAction}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Tariff Optimization: </span>
                {aiInsights.tariffOptimizationTip}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 5 Data Visualization Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Monthly Consumption Trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">1. Monthly Consumption Trend (kWh)</h3>
            <p className="text-xs text-slate-500">Historical monthly kWh trajectory</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={snapshot.monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="kwh"
                  name="Consumption (kWh)"
                  stroke="#065f46"
                  fill="#d1fae5"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Daily Electricity Usage */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">2. Daily Electricity Usage (kWh)</h3>
            <p className="text-xs text-slate-500">Recent daily logs split by Time-of-Day classification</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshot.dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="peakKwh" stackId="a" name="Peak Hours" fill="#d97706" />
                <Bar dataKey="normalKwh" stackId="a" name="Normal Hours" fill="#0f766e" />
                <Bar dataKey="offPeakKwh" stackId="a" name="Off-Peak Hours" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Peak vs Off-Peak Consumption */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">3. Peak vs Off-Peak Consumption</h3>
            <p className="text-xs text-slate-500">Distribution affecting Time-of-Day surcharges &amp; rebates</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshot.peakVsOffPeakChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis dataKey="period" type="category" width={105} tick={{ fontSize: 11, fill: '#334155' }} />
                <Tooltip />
                <Bar dataKey="kwh" name="kWh" radius={[0, 4, 4, 0]}>
                  {snapshot.peakVsOffPeakChartData.map((entry, idx) => (
                    <Cell
                      key={entry.period}
                      fill={idx === 0 ? '#d97706' : idx === 1 ? '#059669' : '#0f172a'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Electricity Cost Trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">4. Electricity Cost Trend (₹)</h3>
            <p className="text-xs text-slate-500">Estimated monthly payable including slabs, taxes &amp; dynamic carbon surcharge</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={snapshot.monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="costInr" name="Total Bill (₹)" fill="#0f172a" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="costInr" name="Trend" stroke="#059669" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Carbon Emissions Trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">5. Carbon Emissions Trend (kg CO₂e)</h3>
              <p className="text-xs text-slate-500">
                Computed at {snapshot.estimatedBill.policyUsed.gridEmissionFactorKgPerKwh} kg CO₂e/kWh regional grid intensity
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('carbon-rewards')}
              className="text-xs font-medium text-emerald-800 hover:underline cursor-pointer self-start sm:self-auto"
            >
              Offset Emissions &amp; Redeem Points →
            </button>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={snapshot.monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="carbonKg"
                  name="Emissions (kg CO₂e)"
                  stroke="#047857"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#047857' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
