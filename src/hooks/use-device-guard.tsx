import { AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useDeviceStore } from '@/stores/device'

/** Renders a banner when no device is selected; feature pages gate on this. */
export function DeviceGuard() {
  return (
    <Card className="border-amber-500/40">
      <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <AlertCircle className="size-4 text-amber-500" />
        Select a device from the top bar to use device-scoped actions.
      </CardContent>
    </Card>
  )
}

export function useSelectedDevice(): string | null {
  return useDeviceStore((state) => state.selectedDeviceId)
}
