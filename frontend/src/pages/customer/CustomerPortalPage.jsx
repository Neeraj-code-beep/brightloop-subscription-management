import React from 'react';
import { UserCheck, CreditCard, Clock } from 'lucide-react';

export function CustomerPortalPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <UserCheck className="w-6 h-6 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Self-Service Portal</h1>
          <p className="text-sm text-gray-600">Review subscription plans, update payment methods, and download tax invoices</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-gray-800 font-semibold">
            <CreditCard className="w-5 h-5 text-emerald-500" />
            My Active Subscriptions
          </div>
          <p className="text-sm text-gray-500">
            View active plan details, renewals, upgrade or downgrade tiers.
          </p>
        </div>

        <div className="p-6 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-gray-800 font-semibold">
            <Clock className="w-5 h-5 text-emerald-500" />
            Billing History & Receipts
          </div>
          <p className="text-sm text-gray-500">
            Access past invoices, download official receipts, and check outstanding balances.
          </p>
        </div>
      </div>
    </div>
  );
}

