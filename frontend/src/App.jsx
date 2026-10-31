import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import DiscountsProvider from './context/DiscountsProvider.jsx'
import InvoicesProvider from './context/InvoicesProvider.jsx'
import RoleProvider from './context/RoleProvider.jsx'
import StaffProvider from './context/StaffProvider.jsx'
import SubscriptionsProvider from './context/SubscriptionsProvider.jsx'
import TaxRulesProvider from './context/TaxRulesProvider.jsx'
import ThemeProvider from './context/ThemeProvider.jsx'
import ToastProvider from './context/ToastProvider.jsx'
import AppRoutes from './routes/AppRoutes.jsx'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RoleProvider>
          <BrowserRouter>
            <ToastProvider>
              <SubscriptionsProvider>
                <DiscountsProvider>
                  <TaxRulesProvider>
                    <InvoicesProvider>
                      <StaffProvider>
                        <AppRoutes />
                      </StaffProvider>
                    </InvoicesProvider>
                  </TaxRulesProvider>
                </DiscountsProvider>
              </SubscriptionsProvider>
            </ToastProvider>
          </BrowserRouter>
        </RoleProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
