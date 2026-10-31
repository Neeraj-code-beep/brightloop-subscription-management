import { Navigate, Route, Routes } from 'react-router-dom'
import RoleGuard from '../components/shared/RoleGuard.jsx'
import { ADMIN_AND_STAFF, ALL_NAV_ITEMS } from '../constants/navigation.js'
import { ROLES } from '../constants/roles.js'
import useAuth from '../hooks/useAuth.js'
import useRole from '../hooks/useRole.js'
import AppLayout from '../layouts/AppLayout.jsx'
import ShellLayout from '../layouts/ShellLayout.jsx'
import ComingSoonPage from '../pages/ComingSoonPage.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'
import LoginPage from '../pages/auth/LoginPage.jsx'
import RegisterPage from '../pages/auth/RegisterPage.jsx'
import CustomerDetailPage from '../pages/admin/CustomerDetailPage.jsx'
import CustomersPage from '../pages/admin/CustomersPage.jsx'
import DashboardPage from '../pages/admin/DashboardPage.jsx'
import DiscountsPage from '../pages/admin/DiscountsPage.jsx'
import InvoiceDetailPage from '../pages/admin/InvoiceDetailPage.jsx'
import InvoicesPage from '../pages/admin/InvoicesPage.jsx'
import SubscriptionDetailPage from '../pages/admin/SubscriptionDetailPage.jsx'
import SubscriptionsPage from '../pages/admin/SubscriptionsPage.jsx'
import CustomerAccountPage from '../pages/customer/CustomerAccountPage.jsx'
import CustomerDashboardPage from '../pages/customer/CustomerDashboardPage.jsx'
import CustomerInvoicesPage from '../pages/customer/CustomerInvoicesPage.jsx'
import CustomerPaymentsPage from '../pages/customer/CustomerPaymentsPage.jsx'
import CustomerSubscriptionPage from '../pages/customer/CustomerSubscriptionPage.jsx'
import PaymentsPage from '../pages/admin/PaymentsPage.jsx'
import ProductPlanDetailPage from '../pages/admin/ProductPlanDetailPage.jsx'
import ProductsPlansPage from '../pages/admin/ProductsPlansPage.jsx'
import TaxesPage from '../pages/admin/TaxesPage.jsx'
import ReportsPage from '../pages/admin/ReportsPage.jsx'
import SettingsPage from '../pages/admin/SettingsPage.jsx'
import StaffPage from '../pages/admin/StaffPage.jsx'

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
  )
}
