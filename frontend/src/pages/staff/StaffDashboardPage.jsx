import React from 'react';
import { Users, FileText, FileSpreadsheet } from 'lucide-react';

export function StaffDashboardPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Portal</h1>
          <p className="text-sm text-gray-600">Operations desk: manage quotations, customer accounts, and manual invoicing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-gray-800 font-semibold">
            <FileSpreadsheet className="w-5 h-5 text-blue-500" />
            Quotations Desk
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Create, send, and track client quotations prior to active subscription onboarding.
          </p>
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded">Scaffolded</span>
        </div>

        <div className="p-6 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-gray-800 font-semibold">
            <FileText className="w-5 h-5 text-blue-500" />
            Invoicing & Billing Cycles
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Inspect pending invoices, process manual adjustments, and review overdue collections.
          </p>
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded">Scaffolded</span>
        </div>
      </div>
    </div>
  );
}

