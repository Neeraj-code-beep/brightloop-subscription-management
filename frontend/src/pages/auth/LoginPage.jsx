import React from 'react';
import { Lock } from 'lucide-react';

export function LoginPage() {
  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-2 mb-4 text-blue-600">
        <Lock className="w-5 h-5" />
        <h2 className="text-xl font-semibold text-gray-900">Sign In to Brightloop SMS</h2>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Ready for authentication implementation with JWT and role-based redirect.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
          <input
            type="email"
            disabled
            placeholder="admin@brightloop.com"
            className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            disabled
            placeholder="••••••••"
            className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>
        <button
          disabled
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md font-medium text-sm opacity-50 cursor-not-allowed"
        >
          Sign In (Scaffolded)
        </button>
      </div>
    </div>
  );
}

