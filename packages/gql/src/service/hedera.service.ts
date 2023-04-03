import { Client, TopicMessageQuery, TopicMessageSubmitTransaction } from '@hashgraph/sdk'
import SubscriptionHandle from '@hashgraph/sdk/lib/topic/SubscriptionHandle'
import { _logger } from '@nftcom/shared'

import { isProduction } from '../config'
import { IHederaConsensusService } from '../defs/hedera'

const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)

const { HCS_ACCOUNT_ID, HCS_ENABLED, HCS_PRIVATE_KEY, HCS_TOPIC_ID } = process.env

class _HederaConsensusService implements IHederaConsensusService {
  HCS: SubscriptionHandle
  client: Client
  topicId: string
  mirrorNetwork: string

  constructor() {
    if (HCS_ENABLED.toLowerCase() !== 'true') {
      return
    }

    if (isProduction()) {
      this.client = Client.forMainnet()
      this.mirrorNetwork = 'mainnet-public.mirrornode.hedera.com:443'
    } else {
      this.client = Client.forTestnet()
      this.mirrorNetwork = 'hcs.testnet.mirrornode.hedera.com:5600'
    }

    this.topicId = HCS_TOPIC_ID
  }

  subscribe(): void {
    if (HCS_ENABLED.toLowerCase() !== 'true') {
      return
    }

    // build consensus client
    this.client.setMirrorNetwork(this.mirrorNetwork)

    // subscribe to topic to listen to all new messages submitted to it
    this.HCS = new TopicMessageQuery().setTopicId(this.topicId).subscribe(
      this.client,
      error => {
        logger.error(error)
      },
      response => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const message = response.contents.toString()
        // logger.info(message)
      },
    )
  }

  unsubscribe(): void {
    if (HCS_ENABLED.toLowerCase() !== 'true') {
      return
    }

    if (!this.HCS) {
      return
    }

    this.HCS.unsubscribe()
  }

  async submitMessage(message: string): Promise<void> {
    if (HCS_ENABLED.toLowerCase() !== 'true') {
      return
    }

    // build client
    const accountId = HCS_ACCOUNT_ID
    const privateKey = HCS_PRIVATE_KEY

    this.client.setOperator(accountId, privateKey)

    // specify topic id and submit a new message to HCS
    await new TopicMessageSubmitTransaction().setTopicId(this.topicId).setMessage(message).execute(this.client)
  }
}

const HederaConsensusService = new _HederaConsensusService()
export default HederaConsensusService
