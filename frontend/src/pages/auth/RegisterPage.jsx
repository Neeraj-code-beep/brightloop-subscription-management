import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../../components/shared/Logo.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import useAuth from '../../hooks/useAuth.js'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) {
      setError('Please fill in all fields.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      await register(name, email, password)
      navigate('/customer/dashboard', { replace: true })
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Registration failed. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Logo className="mb-4 scale-110" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Create Customer Account</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Manage your subscriptions, view invoices, and track payments
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
              Full Name
            </label>
            <Input
              type="text"
              required
              className="mt-1.5"
              placeholder="Alex Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Email address
            </label>
            <Input
              type="email"
              autoComplete="email"
              required
              className="mt-1.5"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Password (min. 8 characters)
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              required
              className="mt-1.5"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <Button type="submit" variant="primary" className="w-full justify-center" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <div className="pt-2 text-center text-xs text-foreground-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

