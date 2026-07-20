import { PageHeader } from '@/components/shared/page-header'
import { PageSurface } from '@/components/shared/page-surface'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppInfo } from '@/hooks/use-app-info'
import { formatBytes } from '@/lib/format'
import { useConnection } from '@/stores/connection'
import { useTranslation } from '@/stores/i18n'

export default function SettingsPage() {
  const { t } = useTranslation()
  const baseUrl = useConnection((state) => state.baseUrl)
  const username = useConnection((state) => state.username)
  const disconnect = useConnection((state) => state.disconnect)
  const { data: info, isLoading: infoLoading, error: infoError } = useAppInfo()

  return (
    <PageSurface padded>
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <PageHeader
          title={t('Settings')}
          description={t('Dashboard connection and server info.')}
        />

      <Card>
        <CardHeader>
          <CardTitle>{t('Connection')}</CardTitle>
          <CardDescription>{t('Where this dashboard sends its requests')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t('Server')}</span>
            <span className="truncate font-mono">{baseUrl}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t('Username')}</span>
            <span className="font-mono">{username || t('— (no basic auth)')}</span>
          </div>
          <div>
            <Button variant="outline" size="sm" onClick={disconnect}>
              {t('Disconnect')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Server')}</CardTitle>
          <CardDescription>{t('Reported by GET /app/info')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {infoLoading && <Skeleton className="h-20" />}
          {infoError && (
            <p className="text-muted-foreground">
              {t('This server does not expose /app/info yet (needs the cross-origin enablers update).')}
            </p>
          )}
          {info && (
            <>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('Version')}</span>
                <span className="font-mono">{info.version}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('Device OS name')}</span>
                <span className="font-mono">{info.os}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('Max image / file / video')}</span>
                <span className="font-mono">
                  {formatBytes(info.max_image_size)} / {formatBytes(info.max_file_size)} /{' '}
                  {formatBytes(info.max_video_size)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </PageSurface>
  )
}
