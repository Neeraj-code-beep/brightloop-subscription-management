import React, { useState, useEffect } from 'react';
import { subscriptionService } from '../../services/subscriptionService.js';
import { ArrowRight, History, CheckCircle2, Clock, XCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function SubscriptionMigrationHistory({ subscriptionId, refreshTrigger }) {
  const [migrations, setMigrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subscriptionId) return;

    async function loadHistory() {
      setLoading(true);
      setError(null);
      try {
        const data = await subscriptionService.getMigrations(subscriptionId);
        setMigrations(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load migration history.');
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [subscriptionId, refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-primary" /> Loading plan change history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-4 h-4" />
        <span>{error}</span>
      </div>
    );
  }

  if (migrations.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 border border-dashed border-slate-200 rounded-lg">
        <History className="w-6 h-6 mx-auto mb-2 text-slate-400" />
        No plan migrations recorded for this subscription yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Plan Change</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Type / Timing</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Net Adjustment</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Adjustment Invoice</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {migrations.map((m) => {
            const isUpgrade = m.migrationType === 'UPGRADE';
            const isDowngrade = m.migrationType === 'DOWNGRADE';
            return (
              <tr key={m.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-xs font-mono">
                  {new Date(m.effectiveDate || m.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <span>{m.fromPlanName || 'Prior Plan'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-primary">{m.toPlanName || 'New Plan'}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {m.fromBillingCycle} &rarr; {m.toBillingCycle}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                    isUpgrade ? 'bg-emerald-100 text-emerald-800' :
                    isDowngrade ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {m.migrationType}
                  </span>
                  <div className="text-xs text-slate-500 mt-0.5">{m.timing}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-mono font-medium">
                  {Number(m.netAdjustment) !== 0 ? (
                    <span className={Number(m.netAdjustment) > 0 ? 'text-emerald-700' : 'text-blue-700'}>
                      {Number(m.netAdjustment) > 0 ? `+${m.netAdjustment}` : m.netAdjustment}
                    </span>
                  ) : (
                    <span className="text-slate-500">0.00</span>
                  )}
                  {Number(m.creditApplied) > 0 && (
                    <div className="text-xs text-slate-500">Credit applied: {m.creditApplied}</div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {m.invoiceNumber ? (
                    <span className="font-mono text-xs text-primary font-medium">{m.invoiceNumber}</span>
                  ) : (
                    <span className="text-xs text-slate-400">&mdash;</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {m.status === 'COMPLETED' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </span>
                  ) : m.status === 'SCHEDULED' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      <Clock className="w-3.5 h-3.5" /> Scheduled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      <XCircle className="w-3.5 h-3.5" /> Cancelled
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
