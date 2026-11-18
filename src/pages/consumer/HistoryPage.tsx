import React, { useMemo, useState } from 'react';
import { Download, Edit3, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ConsumerCategory, EnergyRecord, GranularityType, PeakClassification } from '../../types/energy';

export function HistoryPage() {
  const { energyRecords, updateEnergyRecord, deleteEnergyRecord } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [granularityFilter, setGranularityFilter] = useState<'all' | GranularityType>('all');
  const [peakFilter, setPeakFilter] = useState<'all' | PeakClassification>('all');
  const [editing, setEditing] = useState<EnergyRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return energyRecords.filter((r) => {
      if (granularityFilter !== 'all' && r.granularity !== granularityFilter) return false;
      if (peakFilter !== 'all' && r.peakType !== peakFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const hit =
          r.date.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q) ||
          r.timePeriod.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [energyRecords, granularityFilter, peakFilter, searchTerm]);

  const handleExportCsv = () => {
    const header = 'Date,Granularity,Category,TimePeriod,PeakType,kWh,EstimatedCostINR,CarbonKg,Source,Notes\n';
    const rows = filtered
      .map((r) =>
        [
          r.date,
          r.granularity,
          r.category,
          `"${r.timePeriod.replace(/"/g, '""')}"`,
          r.peakType,
          r.kwh,
          r.estimatedCostInr,
          r.carbonKg,
          r.source,
          `"${r.notes.replace(/"/g, '""')}"`,
        ].join(',')
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecogrid-energy-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await updateEnergyRecord(editing.id, {
        category: editing.category,
        granularity: editing.granularity,
        date: editing.date,
        kwh: Number(editing.kwh),
        timePeriod: editing.timePeriod,
        peakType: editing.peakType,
        notes: editing.notes,
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Consumption History &amp; Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Filter, edit, delete, or export your Firestore energy consumption records.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by date, time period, or notes..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>
        <select
          value={granularityFilter}
          onChange={(e) => setGranularityFilter(e.target.value as 'all' | GranularityType)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="all">All Granularities</option>
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="monthly">Monthly</option>
        </select>
        <select
          value={peakFilter}
          onChange={(e) => setPeakFilter(e.target.value as 'all' | PeakClassification)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="all">All ToD Windows</option>
          <option value="peak">Peak Hours</option>
          <option value="normal">Normal Hours</option>
          <option value="off_peak">Off-Peak Hours</option>
        </select>
      </div>

      {/* Records Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No consumption records match your current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Granularity · Window</th>
                  <th className="py-3 px-4 font-medium">ToD Class</th>
                  <th className="py-3 px-4 font-medium text-right">Usage (kWh)</th>
                  <th className="py-3 px-4 font-medium text-right">Est. Cost (₹)</th>
                  <th className="py-3 px-4 font-medium text-right">Carbon (kg)</th>
                  <th className="py-3 px-4 font-medium">Notes</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {rec.date}
                    </td>
                    <td className="py-3 px-4 text-slate-700 capitalize">
                      {rec.granularity} · <span className="text-slate-500">{rec.timePeriod}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 capitalize">
                      {rec.peakType.replace('_', '-')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {rec.kwh.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      ₹{rec.estimatedCostInr.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {rec.carbonKg.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {rec.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditing({ ...rec })}
                        aria-label="Edit record"
                        className="p-1.5 text-slate-500 hover:text-emerald-800 rounded cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEnergyRecord(rec.id)}
                        aria-label="Delete record"
                        className="p-1.5 text-slate-500 hover:text-rose-700 rounded cursor-pointer ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">
                Edit Consumption Record
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Usage (kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={editing.kwh}
                    onChange={(e) => setEditing({ ...editing, kwh: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Granularity</label>
                  <select
                    value={editing.granularity}
                    onChange={(e) =>
                      setEditing({ ...editing, granularity: e.target.value as GranularityType })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={editing.category}
                    onChange={(e) =>
                      setEditing({ ...editing, category: e.target.value as ConsumerCategory })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="domestic">Domestic</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">ToD Classification</label>
                  <select
                    value={editing.peakType}
                    onChange={(e) =>
                      setEditing({ ...editing, peakType: e.target.value as PeakClassification })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="peak">Peak</option>
                    <option value="normal">Normal</option>
                    <option value="off_peak">Off-Peak</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Time Period</label>
                <input
                  type="text"
                  value={editing.timePeriod}
                  onChange={(e) => setEditing({ ...editing, timePeriod: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
