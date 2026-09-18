'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import { authSchema } from '@/lib/validation/schemas'
import type { AuthInput } from '@/lib/validation/schemas'
import { Button } from '@/components/ui/button'

interface AuthFormProps {
  mode: 'login' | 'signup'
}

export default function AuthForm({ mode }: AuthFormProps) {
  const t = useTranslations('auth')
  const common = useTranslations('common')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const isLogin = mode === 'login'
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthInput>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' },
  })

  const FRIENDLY_ERRORS: { test: RegExp; message: string }[] = [
    { test: /invalid login credentials/i, message: t('errors.invalidCredentials') },
    { test: /email not confirmed/i, message: t('errors.emailNotConfirmed') },
    { test: /already registered/i, message: t('errors.alreadyRegistered') },
    { test: /at least 6 characters/i, message: t('errors.weakPassword') },
    { test: /rate limit|too many requests/i, message: t('errors.rateLimited') },
    { test: /fetch failed|failed to fetch|network|authretryable/i, message: t('errors.unreachable') },
  ]

  function friendlyAuthError(message: string, fallback: string): string {
    const hit = FRIENDLY_ERRORS.find((e) => e.test.test(message))
    return hit ? hit.message : fallback
  }

  async function onSubmit({ email, password }: AuthInput) {
    setError(null)
    setLoading(true)

    const supabase = createClient()

    if (isLogin) {
      const navigateToDashboard = () => {
        router.push('/dashboard')
      }

      try {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (authError) {
          setError(friendlyAuthError(authError.message, common('error')))
          setLoading(false)
          return
        }
        navigateToDashboard()
      } catch {
        navigateToDashboard()
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(friendlyAuthError(error.message, common('error')))
        setLoading(false)
        return
      }
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <p className="text-success font-medium">
          {common('success')}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('successSignupDesc')}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-xs border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('email')}
        </label>
        <input
          id="email"
          type="email"
          placeholder={t('emailPlaceholder')}
          className="rounded-sm border border-border bg-surface-sunken px-3.5 py-2.5 text-sm text-foreground outline-none transition-all duration-180 ease-apple-spring placeholder:text-tertiary-foreground focus:border-accent focus:bg-surface-raised focus:ring-2 focus:ring-accent-muted/40 disabled:opacity-50"
          autoComplete="email"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('password')}
        </label>
        <input
          id="password"
          type="password"
          placeholder={t('passwordPlaceholder')}
          className="rounded-sm border border-border bg-surface-sunken px-3.5 py-2.5 text-sm text-foreground outline-none transition-all duration-180 ease-apple-spring placeholder:text-tertiary-foreground focus:border-accent focus:bg-surface-raised focus:ring-2 focus:ring-accent-muted/40 disabled:opacity-50"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" variant="cta" size="lg" disabled={loading} className="mt-2 w-full shadow-elevation-2">
        {loading ? t('loading') : isLogin ? t('loginButton') : t('signupButton')}
      </Button>
    </form>
  )
}
