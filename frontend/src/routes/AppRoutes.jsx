import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { StaffDashboardPage } from '../pages/staff/StaffDashboardPage';
import { CustomerPortalPage } from '../pages/customer/CustomerPortalPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<Navigate to="/admin" replace />} />
        <Route path="auth/login" element={<LoginPage />} />
        <Route path="admin" element={<AdminDashboardPage />} />
        <Route path="staff" element={<StaffDashboardPage />} />
        <Route path="customer" element={<CustomerPortalPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}

