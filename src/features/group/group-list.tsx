import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, RefreshCw, Users } from 'lucide-react'
import { toast } from 'sonner'
import { leaveGroup, listMyGroups, type MyGroup } from '@/api/group'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSelectedDevice } from '@/hooks/use-device-guard'
import { toApiError } from '@/lib/api-error'
import { formatDate } from '@/lib/format'

/** Strip the @server suffix from a JID for compact display. */
function shortId(jid: string): string {
  return jid.split('@')[0]
}

export function GroupList() {
  const deviceId = useSelectedDevice()
  const queryClient = useQueryClient()
  const [leaveTarget, setLeaveTarget] = useState<MyGroup | null>(null)

  const {
    data: groups,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['groups', deviceId],
    queryFn: listMyGroups,
    enabled: !!deviceId,
  })

  const leave = useMutation({
    mutationFn: leaveGroup,
    onSuccess: () => {
      toast.success(`Left ${leaveTarget?.Name || 'group'}`)
      setLeaveTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-muted-foreground">Groups this device belongs to</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-4 text-sm text-destructive">
            Failed to load groups: {toApiError(error).message}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      {groups && groups.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="font-medium">No groups yet</p>
            <p className="text-sm text-muted-foreground">
              Create a group or join one with an invite link.
            </p>
          </CardContent>
        </Card>
      )}

      {groups && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.JID} className="gap-4">
              <CardHeader>
                <p className="truncate font-medium">{group.Name || shortId(group.JID)}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {shortId(group.JID)}
                </p>
              </CardHeader>
              <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="size-4" />
                {group.Participants?.length ?? group.ParticipantCount ?? 0} participants
                <span className="ml-auto">{formatDate(group.GroupCreated)}</span>
              </CardContent>
              <CardFooter className="justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setLeaveTarget(group)}
                >
                  <LogOut className="size-4" />
                  Leave
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!leaveTarget} onOpenChange={(open) => !open && setLeaveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {leaveTarget?.Name || 'this group'}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be removed from the group. To rejoin you will need a new invite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leaveTarget && leave.mutate({ group_id: leaveTarget.JID })}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
