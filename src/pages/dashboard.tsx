import { useState } from 'react'
import { Smartphone } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { PageSurface } from '@/components/shared/page-surface'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateDeviceDialog } from '@/features/devices/create-device-dialog'
import { DeviceCard } from '@/features/devices/device-card'
import { LoginCodeDialog } from '@/features/session/login-code-dialog'
import { LoginQrDialog } from '@/features/session/login-qr-dialog'
import { useDevices } from '@/hooks/use-devices'
import { toApiError } from '@/lib/api-error'
import type { RegistryDevice } from '@/api/types'

export default function DashboardPage() {
  const { data: devices, isLoading, error } = useDevices()
  const [qrDevice, setQrDevice] = useState<RegistryDevice | null>(null)
  const [codeDevice, setCodeDevice] = useState<RegistryDevice | null>(null)

  return (
    <PageSurface padded>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <PageHeader
          title="Devices"
          description="WhatsApp accounts connected to this server"
          actions={<CreateDeviceDialog />}
        />

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="text-destructive py-4 text-sm">
              Failed to load devices: {toApiError(error).message}
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        )}

        {devices && devices.length === 0 && (
          <EmptyState
            icon={Smartphone}
            title="No devices yet"
            hint="Add a device slot, then pair it with your phone via QR or pairing code."
          />
        )}

        {devices && devices.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onLoginQr={setQrDevice}
                onLoginCode={setCodeDevice}
              />
            ))}
          </div>
        )}

        <LoginQrDialog device={qrDevice} onOpenChange={(open) => !open && setQrDevice(null)} />
        <LoginCodeDialog device={codeDevice} onOpenChange={(open) => !open && setCodeDevice(null)} />
      </div>
    </PageSurface>
  )
}
