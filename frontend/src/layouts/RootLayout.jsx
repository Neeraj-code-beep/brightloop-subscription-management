import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { HealthIndicator } from '../components/shared/HealthIndicator';
import { Layers, Shield, Users, UserCheck, Bot } from 'lucide-react';

export function RootLayout() {
  const location = useLocation();

  const navItems = [
    { label: 'Admin Portal', path: '/admin', icon: Shield },
    { label: 'Staff Portal', path: '/staff', icon: Users },
    { label: 'Customer Portal', path: '/customer', icon: UserCheck },
    { label: 'Login', path: '/auth/login', icon: Layers },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      {/* Top Navigation */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              B
            </div>
            <div>
              <span className="font-semibold text-gray-900">Brightloop SMS</span>
              <span className="ml-2 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">Scaffolding</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <HealthIndicator />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-4 text-center text-xs text-gray-500">
        Brightloop Software Subscription Management System &bull; Team Scaffolding Ready
      </footer>
    </div>
  );
}

