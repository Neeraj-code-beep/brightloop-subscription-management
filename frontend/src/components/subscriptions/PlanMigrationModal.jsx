import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal.jsx';
import { subscriptionService } from '../../services/subscriptionService.js';
import { planService } from '../../services/planService.js';
import { ArrowUpRight, ArrowDownRight, Clock, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function PlanMigrationModal({ open, onClose, subscription, onSuccess }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [timing, setTiming] = useState('IMMEDIATE');
  const [preview, setPreview] = useState(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch active plans when modal opens
  useEffect(() => {
    if (!open || !subscription) return;
    setError(null);
    setPreview(null);
    setSelectedPlanId('');
    setTiming('IMMEDIATE');

    async function loadPlans() {
      setLoadingPlans(true);
      try {
        const res = await planService.getPlans();
        const planList = Array.isArray(res) ? res : (res?.items || []);
        // Filter plans: active and same currency
        const filtered = planList.filter(p => 
          p.isActive && 
          p.id !== subscription.planId &&
          (p.currency || 'INR').toUpperCase() === (subscription.currency || 'INR').toUpperCase()
        );
        setPlans(filtered);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load available plans.');
      } finally {
        setLoadingPlans(false);
      }
    }
    loadPlans();
  }, [open, subscription]);

  // Generate preview whenever selectedPlanId or timing changes
  useEffect(() => {
    if (!selectedPlanId || !subscription?.id) {
      setPreview(null);
      return;
    }

    async function fetchPreview() {
      setPreviewLoading(true);
      setError(null);
      try {
        const previewData = await subscriptionService.previewMigration(subscription.id, {
          targetPlanId: selectedPlanId,
          timing
        });
        setPreview(previewData);
      } catch (err) {
        setPreview(null);
        setError(err.response?.data?.message || err.message || 'Failed to calculate migration preview.');
      } finally {
        setPreviewLoading(false);
      }
    }

    fetchPreview();
  }, [selectedPlanId, timing, subscription?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlanId || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await subscriptionService.migratePlan(subscription.id, {
        targetPlanId: selectedPlanId,
        timing,
        idempotencyKey: `mig-${subscription.id}-${selectedPlanId}-${Date.now()}`
      });
      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to execute plan migration.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Migrate Subscription Plan"
      description={`Change plan for ${subscription?.subscriptionNumber || 'Subscription'}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="flex items-start gap-3 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Current Plan Snapshot */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Current Plan
          </div>
          <div className="flex justify-between items-center">
            <div>
              <span className="font-semibold text-slate-900">{subscription?.plan?.name || 'Current Plan'}</span>
              <span className="ml-2 text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                {subscription?.billingCycle}
              </span>
            </div>
            <div className="font-semibold text-slate-900">
              {subscription?.currency} {subscription?.recurringPrice} / cycle
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Current Period: {new Date(subscription?.currentPeriodStart).toLocaleDateString()} &ndash; {new Date(subscription?.currentPeriodEnd).toLocaleDateString()}
          </div>
        </div>

        {/* Target Plan Selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Target Plan
          </label>
          {loadingPlans ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading plans...
            </div>
          ) : plans.length === 0 ? (
            <div className="text-sm text-slate-500 italic p-3 bg-slate-50 border border-dashed rounded-lg">
              No other active plans with matching currency ({subscription?.currency}) available.
            </div>
          ) : (
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              <option value="">Select a new plan...</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.billingCycle}) &mdash; {p.currency} {p.price}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Migration Timing Options */}
        {selectedPlan && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Migration Timing
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition ${timing === 'IMMEDIATE' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}>
                <input
                  type="radio"
                  name="timing"
                  value="IMMEDIATE"
                  checked={timing === 'IMMEDIATE'}
                  onChange={() => setTiming('IMMEDIATE')}
                  className="mt-1 mr-3 text-primary focus:ring-primary"
                />
                <div>
                  <div className="text-sm font-medium text-slate-900">Immediate Change</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Prorates remaining period value now. Generates adjustment invoice (upgrade) or issues credit (downgrade).
                  </div>
                </div>
              </label>

              <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition ${timing === 'NEXT_CYCLE' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}>
                <input
                  type="radio"
                  name="timing"
                  value="NEXT_CYCLE"
                  checked={timing === 'NEXT_CYCLE'}
                  onChange={() => setTiming('NEXT_CYCLE')}
                  className="mt-1 mr-3 text-primary focus:ring-primary"
                />
                <div>
                  <div className="text-sm font-medium text-slate-900">Next Renewal Cycle</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Keep current plan active until {new Date(subscription?.currentPeriodEnd).toLocaleDateString()}. Applies automatically at renewal.
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Live Proration Breakdown */}
        {previewLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-primary" /> Calculating exact financial proration...
          </div>
        )}

        {preview && !previewLoading && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                {preview.migrationType === 'UPGRADE' ? (
                  <><ArrowUpRight className="w-4 h-4 text-emerald-600" /> Plan Upgrade Breakdown</>
                ) : preview.migrationType === 'DOWNGRADE' ? (
                  <><ArrowDownRight className="w-4 h-4 text-blue-600" /> Plan Downgrade Breakdown</>
                ) : (
                  <><Clock className="w-4 h-4 text-slate-600" /> Plan Change Breakdown</>
                )}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${preview.migrationType === 'UPGRADE' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                {preview.timing}
              </span>
            </div>

            {preview.timing === 'NEXT_CYCLE' ? (
              <div className="text-sm text-slate-600">
                Plan change scheduled for <strong>{new Date(preview.effectiveDate).toLocaleDateString()}</strong>. No immediate charges or credits will be issued today.
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Unused value of current plan:</span>
                  <span className="font-mono text-slate-800">
                    - {preview.pricing.currency} {preview.proration.unusedAmount}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Prorated charge for new plan:</span>
                  <span className="font-mono text-slate-800">
                    + {preview.pricing.currency} {preview.proration.newPlanAmount}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-slate-900 pt-1 border-t border-slate-200">
                  <span>Net Prorated Adjustment:</span>
                  <span className={`font-mono font-bold ${Number(preview.proration.netAdjustment) >= 0 ? 'text-emerald-700' : 'text-blue-700'}`}>
                    {preview.pricing.currency} {preview.proration.netAdjustment}
                  </span>
                </div>

                {Number(preview.proration.creditApplied) > 0 && (
                  <div className="flex justify-between text-emerald-700 text-xs">
                    <span>Customer Credit Applied:</span>
                    <span className="font-mono">- {preview.pricing.currency} {preview.proration.creditApplied}</span>
                  </div>
                )}

                {Number(preview.proration.amountDue) > 0 && (
                  <div className="flex justify-between font-semibold text-slate-900 bg-white p-2 rounded border border-slate-200">
                    <span>Balance Due (Adjustment Invoice):</span>
                    <span className="font-mono text-red-600">
                      {preview.pricing.currency} {preview.proration.amountDue}
                    </span>
                  </div>
                )}

                {Number(preview.proration.creditOwed) > 0 && (
                  <div className="flex justify-between font-semibold text-blue-900 bg-blue-50 p-2 rounded border border-blue-200">
                    <span>Credit to be added to Customer Account:</span>
                    <span className="font-mono text-blue-700">
                      + {preview.pricing.currency} {preview.proration.creditOwed}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 text-xs text-slate-500 border-t border-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Zero setup fee charged during plan migration. Authoritative Prisma.Decimal math applied.</span>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedPlanId || previewLoading || submitting}
            className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Migrating...' : preview?.migrationType === 'UPGRADE' ? 'Confirm Upgrade' : preview?.timing === 'NEXT_CYCLE' ? 'Schedule Downgrade' : 'Confirm Migration'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

