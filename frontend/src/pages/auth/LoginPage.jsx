import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Logo from '../../components/shared/Logo.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import { ROLE_DEFINITIONS, ROLES } from '../../constants/roles.js'
import useAuth from '../../hooks/useAuth.js'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const res = await login(email, password)
      const userRole = res?.user?.role?.toLowerCase()
      const target = from || ROLE_DEFINITIONS[userRole]?.home || '/dashboard'
      navigate(target, { replace: true })
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Authentication failed. Please verify your credentials.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickLogin = (demoEmail, demoPassword) => {
    setEmail(demoEmail)
    setPassword(demoPassword)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Logo className="mb-4 scale-110" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Sign in to your account</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Enter your credentials to access your billing workspace
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Email address
            </label>
            <Input
              type="email"
              autoComplete="email"
              required
              className="mt-1.5"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Password
            </label>
            <Input
              type="password"
              autoComplete="current-password"
              required
              className="mt-1.5"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <Button type="submit" variant="primary" className="w-full justify-center" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="pt-2 text-center text-xs text-foreground-muted">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Register as Customer
          </Link>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <p className="text-center text-xs font-medium text-foreground-subtle">
            Quick credentials:
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@brightloop.io', 'Admin@123456')}
              className="rounded-md border border-border bg-surface-muted px-2.5 py-1 text-xs text-foreground-muted hover:bg-surface-hover hover:text-foreground"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('billing@brightloop.io', 'Staff@123456')}
              className="rounded-md border border-border bg-surface-muted px-2.5 py-1 text-xs text-foreground-muted hover:bg-surface-hover hover:text-foreground"
            >
              Staff
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('arun.kumar@vertex.io', 'Customer@123456')}
              className="rounded-md border border-border bg-surface-muted px-2.5 py-1 text-xs text-foreground-muted hover:bg-surface-hover hover:text-foreground"
            >
              Customer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

