import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth'
import { useTranslation } from '@/stores/i18n'
import { login as loginApi } from '@/api/crm/auth'
import { isApiError } from '@/lib/api-error'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail] = useState('admin@gowa-crm.local')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already logged in — skip the form.
  if (token) return <Navigate to="/" replace />

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { token: jwt, user } = await loginApi(email, password)
      setAuth(jwt, user)
      navigate('/', { replace: true })
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message)
      } else {
        setError('Login failed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-4">
      <Card className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 w-full max-w-md motion-safe:duration-500">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <Logo className="[&_img]:size-10 [&_span]:text-xl" />
            <p className="text-muted-foreground text-xs">{t('CRM sign in')}</p>
          </div>
          <CardTitle className="mt-1">{t('Sign in to your account')}</CardTitle>
          <CardDescription>
            {t('Authenticate against the CRM backend to manage users, contacts, and audit logs.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t('Email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t('Password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting || !email.trim() || !password.trim()}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {t('Sign in')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
