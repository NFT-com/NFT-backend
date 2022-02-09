import { Client, TopicMessageQuery, TopicMessageSubmitTransaction } from '@hashgraph/sdk'
import SubscriptionHandle from '@hashgraph/sdk/lib/topic/SubscriptionHandle'

import { IHederaConsensusService } from '../defs/hedera'

class _HederaConsensusService implements IHederaConsensusService {

  HCS: SubscriptionHandle
  client: Client
  topicId: string

  constructor() {
    this.client = Client.forTestnet()
    this.topicId = process.env.HCS_TOPIC_ID
  }

  subscribe(): void {
    // build consensus client
    this.client.setMirrorNetwork('hcs.testnet.mirrornode.hedera.com:5600')
  
    // subscribe to topic to listen to all new messages submitted to it
    this.HCS = new TopicMessageQuery()
      .setTopicId(this.topicId)
      .subscribe(this.client,
        error => { console.log( error ) },
        response => {
          const message = response.contents.toString()
          console.log(message)
        })
  }

  unsubscribe(): void {
    if (!this.HCS) {
      return
    }

    this.HCS.unsubscribe()
  }

  async submitMessage(message: string): Promise<void> {
    // build client
    const accountId = process.env.HCS_ACCOUNT_ID
    const privateKey = process.env.HCS_PRIVATE_KEY

    this.client.setOperator(accountId, privateKey)

    // specify topic id and submit a new message to HCS
    await new TopicMessageSubmitTransaction()
      .setTopicId(this.topicId)
      .setMessage(message)
      .execute(this.client)
  }

}

const HederaConsensusService = new _HederaConsensusService()
export default HederaConsensusService
