import { Outlet } from 'react-router-dom'
import Logo from '../components/shared/Logo.jsx'
import { APP_TAGLINE } from '../constants/app.js'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />
          <span className="hidden text-sm text-foreground-muted sm:block">{APP_TAGLINE}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-foreground-subtle sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} Brightloop. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
