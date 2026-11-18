import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, Gift, Leaf, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { OffsetRewardItem } from '../../types/energy';
import { CATEGORY_BENCHMARK_KWH, OFFSET_CATALOG } from '../../utils/carbonRewards';
import { buildDashboardSnapshot } from '../../utils/dashboardMetrics';
import { buildDemoEnergyRecords } from '../../utils/demoData';

export function CarbonRewardsPage() {
  const {
    profile,
    energyRecords,
    bills,
    redemptions,
    tariffPolicies,
    useDemoPreview,
    redeemOffsetReward,
    creditRewardPoints,
  } = useAuth();

  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const hasLive = energyRecords.length > 0 || bills.length > 0;

  const activeRecords = useMemo(() => {
    if (!profile) return [];
    if (hasLive && !useDemoPreview) return energyRecords;
    if (useDemoPreview) {
      return buildDemoEnergyRecords(profile.uid, profile.category, profile.state, profile.discom);
    }
    return [];
  }, [profile, energyRecords, hasLive, useDemoPreview]);

  const snapshot = useMemo(() => {
    if (!profile) return null;
    return buildDashboardSnapshot(
      profile,
      activeRecords,
      tariffPolicies,
      !hasLive || useDemoPreview,
      useDemoPreview ? [] : bills
    );
  }, [profile, activeRecords, tariffPolicies, hasLive, useDemoPreview, bills]);

  if (!profile || !snapshot) return null;

  const benchmarkKwh = CATEGORY_BENCHMARK_KWH[profile.category];
  const netEmissionsKg = Math.max(0, Number((snapshot.carbonEmissionKg - profile.totalCarbonOffsetKg).toFixed(1)));

  const handleRedeem = async (item: OffsetRewardItem) => {
    if (profile.rewardPointsBalance < item.pointsCost) return;
    setRedeemingId(item.id);
    try {
      await redeemOffsetReward(item);
    } finally {
      setRedeemingId(null);
    }
  };

  const handleClaimPoints = async () => {
    if (snapshot.earnedPoints.totalEarnedPoints <= 0) return;
    setClaiming(true);
    try {
      await creditRewardPoints(snapshot.earnedPoints.totalEarnedPoints);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Carbon Offsets &amp; Green Reward Points
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Earn Green Reward Points by reducing kWh consumption below historical averages or {profile.category} benchmarks ({benchmarkKwh} kWh/mo), shifting loads to off-peak hours, and adopting clean energy.
        </p>
      </div>

      {/* Carbon & Wallet Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Available Points Wallet</span>
            <Award className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {profile.rewardPointsBalance.toLocaleString()} <span className="text-sm font-normal text-slate-500">pts</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Redeemable below</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Cumulative Offsets Retired</span>
            <Leaf className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-emerald-800 tabular-nums">
            {profile.totalCarbonOffsetKg.toLocaleString()} <span className="text-sm font-normal text-slate-500">kg CO₂e</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Verified in Firestore ledger</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Net Monthly Footprint</span>
            <Sparkles className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {netEmissionsKg.toLocaleString()} <span className="text-sm font-normal text-slate-500">kg CO₂e</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Gross {snapshot.carbonEmissionKg} kg minus offsets</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Bill Rebates Redeemed</span>
            <Gift className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            ₹{profile.totalBillDiscountInr.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">Applied to tariff credits</p>
        </div>
      </div>

      {/* Points Earning Calculation Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Current Cycle Green Points Qualification
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              10 pts per 1% reduction vs baseline · +2 pts/kWh off-peak shifting · Solar &amp; logging consistency bonuses
            </p>
          </div>
          <button
            type="button"
            disabled={claiming || snapshot.earnedPoints.totalEarnedPoints <= 0}
            onClick={handleClaimPoints}
            className="px-4 py-2 bg-emerald-800 text-white text-xs font-medium rounded-lg hover:bg-emerald-900 disabled:opacity-50 cursor-pointer shrink-0"
          >
            {claiming
              ? 'Crediting...'
              : `Credit +${snapshot.earnedPoints.totalEarnedPoints} Cycle Points`}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-slate-500">Reduction vs Benchmark</p>
            <p className="font-mono text-lg font-bold text-slate-900 tabular-nums mt-1">
              +{snapshot.earnedPoints.reductionPoints} pts
            </p>
            <p className="text-slate-500 mt-0.5 tabular-nums">
              {snapshot.earnedPoints.reductionPercentVsBenchmark}% delta
            </p>
          </div>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-slate-500">Off-Peak Shifting Bonus</p>
            <p className="font-mono text-lg font-bold text-slate-900 tabular-nums mt-1">
              +{snapshot.earnedPoints.offPeakPoints} pts
            </p>
            <p className="text-slate-500 mt-0.5 tabular-nums">{snapshot.offPeakKwh} kWh off-peak</p>
          </div>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-slate-500">Solar / Clean Energy</p>
            <p className="font-mono text-lg font-bold text-slate-900 tabular-nums mt-1">
              +{snapshot.earnedPoints.cleanEnergyPoints} pts
            </p>
            <p className="text-slate-500 mt-0.5">Rooftop solar capacity</p>
          </div>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-slate-500">Tracking Consistency</p>
            <p className="font-mono text-lg font-bold text-slate-900 tabular-nums mt-1">
              +{snapshot.earnedPoints.consistencyPoints} pts
            </p>
            <p className="text-slate-500 mt-0.5 tabular-nums">{activeRecords.length} entries logged</p>
          </div>
        </div>
      </div>

      {/* Redemption Marketplace */}
      <div className="space-y-3">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Carbon Offset &amp; Tariff Discount Redemption Marketplace
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {OFFSET_CATALOG.map((item) => {
            const affordable = profile.rewardPointsBalance >= item.pointsCost;
            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <p className="text-xs text-slate-500 mb-1">
                    {item.rewardType === 'carbon_offset' ? 'Virtual Carbon Offset' : 'Tariff Discount Voucher'} · {item.partnerProgram}
                  </p>
                  <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{item.description}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="font-mono text-sm font-bold text-emerald-800 tabular-nums">
                    {item.pointsCost} pts
                  </span>
                  <button
                    type="button"
                    disabled={!affordable || redeemingId === item.id}
                    onClick={() => handleRedeem(item)}
                    className="px-3.5 py-2 bg-emerald-800 text-white text-xs font-medium rounded-lg hover:bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer transition-colors"
                  >
                    {redeemingId === item.id
                      ? 'Redeeming...'
                      : affordable
                      ? 'Redeem Now'
                      : `Need ${item.pointsCost - profile.rewardPointsBalance} more`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verifiable Redemption Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-display text-base font-semibold text-slate-900 mb-4">
          Offset &amp; Voucher Redemption Ledger ({redemptions.length})
        </h2>
        {redemptions.length === 0 ? (
          <p className="text-xs text-slate-500">
            No redemptions recorded yet. Redeem your available Green Reward Points above to issue a verifiable carbon offset certificate or tariff rebate voucher.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Certificate / Voucher Code</th>
                  <th className="py-2.5 pr-4 font-medium">Reward</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Points Spent</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Impact</th>
                  <th className="py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {redemptions.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 pr-4 font-mono font-semibold text-slate-900">
                      {r.certificateCode}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{r.rewardTitle}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-slate-900">
                      -{r.pointsSpent} pts
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-emerald-800">
                      {r.carbonOffsetKg > 0 ? `${r.carbonOffsetKg} kg CO₂e` : `₹${r.discountInr} rebate`}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium capitalize">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {r.status}
                      </span>
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
