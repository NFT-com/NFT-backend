import { Client } from '@hashgraph/sdk'
import SubscriptionHandle from '@hashgraph/sdk/lib/topic/SubscriptionHandle'

export interface IHederaConsensusService {
  HCS: SubscriptionHandle
  client: Client
  topicId: string
  mirrorNetwork: string

  submitMessage(message: string): Promise<void>
  subscribe(): void
  unsubscribe(): void
}
