import React from 'react';
import { ShieldCheck, BarChart3, CreditCard, Users, Settings } from 'lucide-react';

export function AdminDashboardPage() {
  const cards = [
    { title: 'MRR & Revenue', value: '$0.00', icon: BarChart3, desc: 'Recurring revenue stream' },
    { title: 'Active Subscriptions', value: '0', icon: CreditCard, desc: 'Current active accounts' },
    { title: 'Customer Base', value: '0', icon: Users, desc: 'Registered customers' },
    { title: 'System Health', value: 'Ready', icon: Settings, desc: 'All modules scaffolded' },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Control Center</h1>
          <p className="text-sm text-gray-600">Enterprise governance, revenue metrics, and configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase">{card.title}</span>
                <Icon className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-2xl font-semibold text-gray-900">{card.value}</div>
              <div className="text-xs text-gray-500 mt-1">{card.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

