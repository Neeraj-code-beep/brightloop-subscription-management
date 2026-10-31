import { LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { getNavGroupsForRole } from '../../constants/navigation.js'
import useRole from '../../hooks/useRole.js'
import { cn } from '../../utils/cn.js'
import Logo from './Logo.jsx'
import UserAvatar from './UserAvatar.jsx'

export default function Sidebar({ open, collapsed, onClose }) {
  const { role, user } = useRole()
  const navGroups = getNavGroupsForRole(role)

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-[transform,width] duration-200 ease-out',
          'lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0',
          collapsed ? 'lg:w-[72px]' : 'lg:w-60',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-border px-5',
            collapsed && 'lg:justify-center lg:px-0',
          )}
        >
          <Logo iconOnlyOnDesktop={collapsed} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Main navigation">
          {navGroups.map((group, groupIndex) => (
            <div key={group.label} className={cn(groupIndex > 0 && 'mt-6')}>
              <p
                className={cn(
                  'px-3 pb-2 text-xs font-medium uppercase tracking-wider text-foreground-subtle',
                  collapsed && 'lg:sr-only',
                )}
              >
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(({ label, path, icon: Icon }) => (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={onClose}
                    title={collapsed ? label : undefined}
                    aria-label={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                        collapsed && 'lg:justify-center lg:px-0',
                        isActive
                          ? 'bg-primary-soft text-primary-soft-text'
                          : 'text-foreground-muted hover:bg-surface-hover hover:text-foreground',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-primary"
                            aria-hidden="true"
                          />
                        )}
                        <Icon
                          size={18}
                          strokeWidth={2}
                          aria-hidden="true"
                          className={cn(
                            'shrink-0',
                            isActive
                              ? 'text-primary'
                              : 'text-foreground-subtle group-hover:text-foreground-muted',
                          )}
                        />
                        <span className={cn('truncate', collapsed && 'lg:hidden')}>{label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-border p-3">
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg px-2 py-2',
              collapsed && 'lg:justify-center lg:px-0',
            )}
          >
            <UserAvatar name={user.name} />
            <div className={cn('min-w-0', collapsed && 'lg:hidden')}>
              <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs text-foreground-subtle">{user.title}</p>
            </div>
          </div>
          <button
            type="button"
            title={collapsed ? 'Log out' : undefined}
            aria-label={collapsed ? 'Log out' : undefined}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              collapsed && 'lg:justify-center lg:px-0',
            )}
          >
            <LogOut size={18} className="shrink-0 text-foreground-subtle" aria-hidden="true" />
            <span className={cn(collapsed && 'lg:hidden')}>Log out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
