import { Bell, Check, ChevronDown, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Settings, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ROLE_DEFINITIONS, ROLE_IDS } from '../../constants/roles.js'
import { ALL_NAV_ITEMS } from '../../constants/navigation.js'
import { DEMO_USERS } from '../../data/users.js'
import useAuth from '../../hooks/useAuth.js'
import useRole from '../../hooks/useRole.js'
import useTheme from '../../hooks/useTheme.js'
import { cn } from '../../utils/cn.js'
import GlobalSearch from './GlobalSearch.jsx'
import UserAvatar from './UserAvatar.jsx'

const iconButtonClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const menuOptionClass =
  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground'

const segmentClass = (active) =>
  cn(
    'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-150',
    active ? 'bg-surface text-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground',
  )

export default function TopHeader({ onMenuClick, collapsed, onToggleCollapsed }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { role, user, definition } = useRole()
  const { logout, isAuthenticated } = useAuth()
  const { isDark, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const pageTitle = ALL_NAV_ITEMS.find((item) => item.path === pathname)?.label ?? 'Brightloop'

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="sticky top-0 z-20">
      <header className="flex h-16 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6 lg:gap-4 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          className={cn('-ml-2 lg:hidden', iconButtonClass)}
          aria-label="Open navigation"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn('-ml-2 hidden lg:flex', iconButtonClass)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen size={20} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={20} aria-hidden="true" />
          )}
        </button>

        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground sm:flex-none sm:text-lg">
          {pageTitle}
        </h1>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="hidden md:block">
            <GlobalSearch />
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen((prev) => !prev)}
            className={cn('md:hidden', iconButtonClass)}
            aria-label="Search"
          >
            <Search size={20} aria-hidden="true" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex items-center gap-3 rounded-xl p-1.5 transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-label="User menu"
            >
              <UserAvatar name={user.name} avatar={user.avatar} size="sm" />
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-tight text-foreground">{user.name}</span>
                <span className="block text-xs leading-tight text-foreground-subtle">{definition.label}</span>
              </span>
              <ChevronDown size={16} className="hidden text-foreground-subtle sm:block" aria-hidden="true" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div
                  role="menu"
                  className="absolute right-0 z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                    <p className="truncate text-xs text-foreground-subtle">{user.email}</p>
                    <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {definition.label}
                    </span>
                  </div>

                  <div className="space-y-2 border-b border-border p-3">
                    <p className="px-1 text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                      Appearance
                    </p>
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1">
                      <button
                        type="button"
                        aria-pressed={!isDark}
                        onClick={() => setTheme('light')}
                        className={segmentClass(!isDark)}
                      >
                        <Sun size={14} aria-hidden="true" />
                        Light
                      </button>
                      <button
                        type="button"
                        aria-pressed={isDark}
                        onClick={() => setTheme('dark')}
                        className={segmentClass(isDark)}
                      >
                        <Moon size={14} aria-hidden="true" />
                        Dark
                      </button>
                    </div>
                  </div>

                  {definition.accountPath && (
                    <div className="p-1 border-b border-border">
                      <Link
                        to={definition.accountPath}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className={menuOptionClass}
                      >
                        <span className="flex items-center gap-2.5">
                          <Settings size={16} className="text-foreground-subtle" aria-hidden="true" />
                          {definition.accountLabel}
                        </span>
                      </Link>
                    </div>
                  )}

                  <div className="p-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className={cn(menuOptionClass, 'text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400')}
                    >
                      <span className="flex items-center gap-2.5">
                        <LogOut size={16} aria-hidden="true" />
                        Sign Out
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="border-b border-border bg-surface px-4 py-3 md:hidden">
          <GlobalSearch autoFocus className="w-full" onNavigate={() => setSearchOpen(false)} />
        </div>
      )}
    </div>
  )
}
