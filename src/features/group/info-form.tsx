import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { getGroupInfo } from '@/api/group'
import { ResultPanel } from '@/components/shared/result-panel'
import { toApiError } from '@/lib/api-error'

export function GroupOverview({ groupJid }: { groupJid: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['group-info', groupJid],
    queryFn: () => getGroupInfo({ group_id: groupJid }),
    enabled: !!groupJid,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
      </div>
    )
  }
  if (error) {
    return <p className="text-destructive text-sm">{toApiError(error).message}</p>
  }
  return <ResultPanel result={data} />
}
