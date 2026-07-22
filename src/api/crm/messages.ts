import { api, unwrap } from '@/lib/api'

export interface MessageStats {
  total: number
  inbound: number
  outbound: number
}

export async function getMessageStats(): Promise<MessageStats> {
  return unwrap<MessageStats>(api.get('/messages/stats'))
}
