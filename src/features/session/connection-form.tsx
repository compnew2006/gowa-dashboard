import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConnection, type TestResult } from '@/stores/connection'
import { useTranslation } from '@/stores/i18n'

const errorMessages: Record<Exclude<TestResult, 'ok'>, string> = {
  unauthorized: 'The server rejected these credentials (401).',
  'not-gowa': 'That URL answered, but it does not look like a gowa server.',
  unreachable: 'Could not reach the server. Check the URL and that gowa is running.',
}

/**
 * Editable gowa connection form: Server URL + optional basic-auth credentials,
 * connect-on-submit, and inline status messaging keyed by `TestResult`.
 *
 * Pure presentational form — no page-level navigation. On a successful connect
 * the store flips to `connected`; when this lives inside the Settings card the
 * banner elsewhere disappears and the user stays on `/settings`.
 */
export function ConnectionForm() {
  const { t } = useTranslation()
  const status = useConnection((state) => state.status)
  const storedUrl = useConnection((state) => state.baseUrl)
  const storedUser = useConnection((state) => state.username)
  const connect = useConnection((state) => state.connect)

  const [url, setUrl] = useState(
    storedUrl ?? (import.meta.env.VITE_DEFAULT_SERVER_URL as string | undefined) ?? '',
  )
  const [username, setUsername] = useState(storedUser ?? '')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await connect(url, username || undefined, password || undefined)
    setSubmitting(false)
    if (result !== 'ok') {
      setError(errorMessages[result])
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="server-url">{t('Server URL')}</Label>
        <Input
          id="server-url"
          placeholder="http://localhost:3000"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">{t('Username')}</Label>
          <Input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">{t('Password')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{t(error)}</p>}
      {status === 'unauthorized' && !error && (
        <p className="text-destructive text-sm">
          {t('The stored credentials were rejected — enter them again.')}
        </p>
      )}
      {status === 'unreachable' && !error && (
        <p className="text-muted-foreground text-sm">
          {t('The stored server was unreachable — check it and reconnect.')}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={submitting || !url.trim()}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {t('Connect')}
      </Button>
    </form>
  )
}
