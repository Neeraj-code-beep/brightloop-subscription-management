import React, { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import RoleGuard from '../components/shared/RoleGuard.jsx'
import { ADMIN_AND_STAFF, ALL_NAV_ITEMS } from '../constants/navigation.js'
import { ROLES } from '../constants/roles.js'
import useAuth from '../hooks/useAuth.js'
import useRole from '../hooks/useRole.js'
import AppLayout from '../layouts/AppLayout.jsx'
import ShellLayout from '../layouts/ShellLayout.jsx'

// Route-level code splitting
const LoginPage = lazy(() => import('../pages/auth/LoginPage.jsx'))
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage.jsx'))
const ComingSoonPage = lazy(() => import('../pages/ComingSoonPage.jsx'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage.jsx'))
const CustomerDetailPage = lazy(() => import('../pages/admin/CustomerDetailPage.jsx'))
const CustomersPage = lazy(() => import('../pages/admin/CustomersPage.jsx'))
const DashboardPage = lazy(() => import('../pages/admin/DashboardPage.jsx'))
const DiscountsPage = lazy(() => import('../pages/admin/DiscountsPage.jsx'))
const InvoiceDetailPage = lazy(() => import('../pages/admin/InvoiceDetailPage.jsx'))
const InvoicesPage = lazy(() => import('../pages/admin/InvoicesPage.jsx'))
const SubscriptionDetailPage = lazy(() => import('../pages/admin/SubscriptionDetailPage.jsx'))
const SubscriptionsPage = lazy(() => import('../pages/admin/SubscriptionsPage.jsx'))
const CustomerAccountPage = lazy(() => import('../pages/customer/CustomerAccountPage.jsx'))
const CustomerDashboardPage = lazy(() => import('../pages/customer/CustomerDashboardPage.jsx'))
const CustomerInvoicesPage = lazy(() => import('../pages/customer/CustomerInvoicesPage.jsx'))
const CustomerPaymentsPage = lazy(() => import('../pages/customer/CustomerPaymentsPage.jsx'))
const CustomerSubscriptionPage = lazy(() => import('../pages/customer/CustomerSubscriptionPage.jsx'))
const PaymentsPage = lazy(() => import('../pages/admin/PaymentsPage.jsx'))
const ProductPlanDetailPage = lazy(() => import('../pages/admin/ProductPlanDetailPage.jsx'))
const ProductsPlansPage = lazy(() => import('../pages/admin/ProductsPlansPage.jsx'))
const TaxesPage = lazy(() => import('../pages/admin/TaxesPage.jsx'))
const ReportsPage = lazy(() => import('../pages/admin/ReportsPage.jsx'))
const SettingsPage = lazy(() => import('../pages/admin/SettingsPage.jsx'))
const StaffPage = lazy(() => import('../pages/admin/StaffPage.jsx'))

const IMPLEMENTED_PAGES = {
  '/dashboard': DashboardPage,
  '/subscriptions': SubscriptionsPage,
  '/customers': CustomersPage,
  '/invoices': InvoicesPage,
  '/payments': PaymentsPage,
  '/discounts': DiscountsPage,
  '/products-plans': ProductsPlansPage,
  '/taxes': TaxesPage,
  '/reports': ReportsPage,
  '/staff': StaffPage,
  '/settings': SettingsPage,
  '/customer/dashboard': CustomerDashboardPage,
  '/customer/subscription': CustomerSubscriptionPage,
  '/customer/invoices': CustomerInvoicesPage,
  '/customer/payments': CustomerPaymentsPage,
  '/customer/account': CustomerAccountPage,
}

function PageSuspenseFallback() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-foreground-muted">Loading view...</span>
      </div>
    </div>
  )
}

function HomeRedirect() {
  const { isAuthenticated, loading } = useAuth()
  const { definition } = useRole()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={definition.home} replace />
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route index element={<HomeRedirect />} />

        <Route element={<ShellLayout />}>
          <Route
            path="subscriptions/:id"
            element={
              <RoleGuard allowedRoles={ADMIN_AND_STAFF}>
                <SubscriptionDetailPage />
              </RoleGuard>
            }
          />
          <Route
            path="products-plans/:id"
            element={
              <RoleGuard allowedRoles={ADMIN_AND_STAFF}>
                <ProductPlanDetailPage />
              </RoleGuard>
            }
          />
          <Route
            path="customers/:id"
            element={
              <RoleGuard allowedRoles={ADMIN_AND_STAFF}>
                <CustomerDetailPage />
              </RoleGuard>
            }
          />
          <Route
            path="invoices/:id"
            element={
              <RoleGuard allowedRoles={ADMIN_AND_STAFF}>
                <InvoiceDetailPage />
              </RoleGuard>
            }
          />
          <Route
            path="customer/invoices/:id"
            element={
              <RoleGuard allowedRoles={[ROLES.CUSTOMER]}>
                <InvoiceDetailPage />
              </RoleGuard>
            }
          />
          {ALL_NAV_ITEMS.map(({ label, path, roles }) => {
            const Page = IMPLEMENTED_PAGES[path]
            return (
              <Route
                key={path}
                path={path.slice(1)}
                element={
                  <RoleGuard allowedRoles={roles}>
                    {Page ? <Page /> : <ComingSoonPage title={label} />}
                  </RoleGuard>
                }
              />
            )
          })}
        </Route>

        <Route element={<AppLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
