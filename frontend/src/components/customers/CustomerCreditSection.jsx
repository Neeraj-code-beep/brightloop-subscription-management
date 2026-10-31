import React, { useState, useEffect } from 'react';
import { creditService } from '../../services/creditService.js';
import Card from '../ui/Card.jsx';
import Modal from '../ui/Modal.jsx';
import { Coins, PlusCircle, MinusCircle, History, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { buttonVariants } from '../ui/buttonStyles.js';

export default function CustomerCreditSection({ customerId, isAdmin = false }) {
  const [balance, setBalance] = useState('0.00');
  const [currency, setCurrency] = useState('INR');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Adjust Modal state
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('ADD'); // 'ADD' or 'DEDUCT'
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState(null);

  const loadData = async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const [balRes, txRes] = await Promise.all([
        creditService.getCustomerCredits(customerId),
        creditService.getCreditTransactions(customerId, { limit: 20 })
      ]);
      setBalance(balRes?.creditBalance || '0.00');
      setCurrency(balRes?.currency || 'INR');
      const list = Array.isArray(txRes?.data) ? txRes.data : Array.isArray(txRes) ? txRes : [];
      setTransactions(list);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load credits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [customerId]);

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    const num = parseFloat(adjustAmount);
    if (!num || num <= 0 || !adjustReason) return;

    setAdjusting(true);
    setAdjustError(null);
    try {
      const finalAmount = adjustType === 'ADD' ? num.toFixed(2) : (-num).toFixed(2);
      await creditService.adjustCredits(customerId, {
        amount: finalAmount,
        reason: adjustReason,
        idempotencyKey: `adj-${customerId}-${Date.now()}`
      });
      setAdjustOpen(false);
      setAdjustAmount('');
      setAdjustReason('');
      await loadData();
    } catch (err) {
      setAdjustError(err.response?.data?.message || err.message || 'Failed to adjust credit balance');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-semibold text-foreground">Customer Credits & Ledger</h3>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setAdjustError(null);
              setAdjustOpen(true);
            }}
            className={buttonVariants({ variant: 'outline', className: 'text-xs' })}
          >
            Adjust Balance
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-amber-50/50 border-amber-200">
          <div className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-1">
            Available Credit Balance
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900">
            {currency} {balance}
          </div>
          <p className="text-xs text-amber-600 mt-1">
            Automatically applies toward future invoices & plan upgrades.
          </p>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-6 text-sm text-foreground-muted">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading transaction ledger...
        </div>
      ) : error ? (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>
      ) : transactions.length === 0 ? (
        <Card className="p-6 text-center text-sm text-foreground-muted">
          No credit transactions recorded for this customer yet.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface-muted text-foreground-muted text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Balance After</th>
                  <th className="px-4 py-3 text-left">Reason / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {transactions.map((tx) => {
                  const isPositive = Number(tx.amount) > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-surface-hover/50">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-foreground-muted font-mono">
                        {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                          tx.type === 'PRORATION_CREDIT' ? 'bg-blue-100 text-blue-800' :
                          tx.type === 'INVOICE_APPLICATION' ? 'bg-emerald-100 text-emerald-800' :
                          tx.type === 'MANUAL_ADJUSTMENT' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono font-medium">
                        <span className={isPositive ? 'text-emerald-600' : 'text-slate-600'}>
                          {isPositive ? `+${tx.amount}` : tx.amount}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono text-foreground-muted">
                        {tx.currency} {tx.balanceAfter}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-foreground-muted max-w-xs truncate">
                        {tx.reason || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Adjust Modal */}
      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Adjust Customer Credit Balance"
        description="Grant or deduct credit from customer running balance."
      >
        <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
          {adjustError && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {adjustError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Adjustment Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center justify-center p-2.5 border rounded-lg cursor-pointer text-sm font-medium transition ${
                adjustType === 'ADD' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-foreground hover:bg-surface-hover'
              }`}>
                <input
                  type="radio"
                  name="adjustType"
                  value="ADD"
                  checked={adjustType === 'ADD'}
                  onChange={() => setAdjustType('ADD')}
                  className="sr-only"
                />
                <PlusCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
                Add Credit
              </label>
              <label className={`flex items-center justify-center p-2.5 border rounded-lg cursor-pointer text-sm font-medium transition ${
                adjustType === 'DEDUCT' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-foreground hover:bg-surface-hover'
              }`}>
                <input
                  type="radio"
                  name="adjustType"
                  value="DEDUCT"
                  checked={adjustType === 'DEDUCT'}
                  onChange={() => setAdjustType('DEDUCT')}
                  className="sr-only"
                />
                <MinusCircle className="w-4 h-4 mr-1.5 text-red-600" />
                Deduct Credit
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Amount ({currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Reason for Adjustment
            </label>
            <textarea
              required
              rows={3}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g. Promotional goodwill credit, Billing correction..."
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setAdjustOpen(false)}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adjusting || !adjustAmount || !adjustReason}
              className={buttonVariants({ variant: 'primary' })}
            >
              {adjusting && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {adjusting ? 'Adjusting...' : 'Save Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
