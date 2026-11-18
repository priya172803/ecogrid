import React, { useState } from 'react';
import { Megaphone, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ConsumerCategory } from '../../types/energy';
import { STATE_DISCOM_OPTIONS } from '../../utils/tariffEngine';

export function PolicyAdvisoryPage() {
  const { advisories, publishAdvisory, deleteAdvisory } = useAuth();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetCategory, setTargetCategory] = useState<'all' | ConsumerCategory>('all');
  const [targetState, setTargetState] = useState('All States');
  const [severity, setSeverity] = useState<'info' | 'advisory' | 'peak_alert'>('advisory');
  const [saving, setSaving] = useState(false);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSaving(true);
    try {
      await publishAdvisory({
        title: title.trim(),
        message: message.trim(),
        targetCategory,
        targetState,
        severity,
      });
      setTitle('');
      setMessage('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Grid Policy Advisories &amp; Peak Demand Alerts
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Broadcast targeted regulatory notices, peak-demand advisories, and conservation incentives directly to Consumer Portal dashboards.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handlePublish}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 text-emerald-800 pb-2 border-b border-slate-200">
            <Megaphone className="w-4 h-4" />
            <h2 className="text-sm font-semibold text-slate-900">Broadcast New Advisory</h2>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Advisory Title *</label>
            <input
              type="text"
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Evening Peak ToD Surcharge Advisory (18:00–22:00)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Target Category</label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value as 'all' | ConsumerCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="all">All Categories</option>
                <option value="domestic">Domestic</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Target State</label>
              <select
                value={targetState}
                onChange={(e) => setTargetState(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="All States">All States</option>
                {Object.keys(STATE_DISCOM_OPTIONS).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Severity Level</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as 'info' | 'advisory' | 'peak_alert')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="info">Informational Notice</option>
              <option value="advisory">Conservation Advisory</option>
              <option value="peak_alert">Peak Demand Alert</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Policy Message *</label>
            <textarea
              rows={4}
              required
              maxLength={800}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain tariff updates, off-peak rebates, or load reduction guidance..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2.5 bg-emerald-800 text-white text-xs font-medium rounded-lg hover:bg-emerald-900 disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Publishing...' : 'Publish Policy Advisory'}
          </button>
        </form>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Active Consumer Advisories ({advisories.length})
          </h2>
          {advisories.length === 0 ? (
            <p className="text-xs text-slate-500">No policy advisories published yet.</p>
          ) : (
            <div className="space-y-3">
              {advisories.map((adv) => (
                <div
                  key={adv.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-mono font-semibold text-slate-800 uppercase">
                        {adv.severity.replace('_', ' ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{adv.targetCategory}</span>
                      <span aria-hidden="true">·</span>
                      <span>{adv.targetState}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{adv.title}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{adv.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteAdvisory(adv.id)}
                    aria-label="Delete advisory"
                    className="p-1.5 text-slate-400 hover:text-rose-700 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
