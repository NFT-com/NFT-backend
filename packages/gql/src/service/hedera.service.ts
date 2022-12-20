// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Client, TopicMessageQuery, TopicMessageSubmitTransaction } from '@hashgraph/sdk'
import SubscriptionHandle from '@hashgraph/sdk/lib/topic/SubscriptionHandle'
import { _logger } from '@nftcom/shared'

import { isProduction } from '../config'
import { IHederaConsensusService } from '../defs/hedera'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)

class _HederaConsensusService implements IHederaConsensusService {

  HCS: SubscriptionHandle
  client: Client
  topicId: string
  mirrorNetwork: string

  constructor() {
    if (isProduction()) {
      this.client = Client.forMainnet()
      this.mirrorNetwork = 'mainnet-public.mirrornode.hedera.com:443'
    } else {
      this.client = Client.forTestnet()
      this.mirrorNetwork = 'hcs.testnet.mirrornode.hedera.com:5600'
    }

    this.topicId = process.env.HCS_TOPIC_ID
  }

  subscribe(): void {
    // build consensus client
    this.client.setMirrorNetwork(this.mirrorNetwork)
  
    // subscribe to topic to listen to all new messages submitted to it
    // this.HCS = new TopicMessageQuery()
    //   .setTopicId(this.topicId)
    //   .subscribe(this.client,
    //     error => { logger.error( error ) },
    //     response => {
    //       // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //       const message = response.contents.toString()
    //       // logger.info(message)
    //     })
  }

  unsubscribe(): void {
    return

    // if (!this.HCS) {
    //   return
    // }

    // this.HCS.unsubscribe()
  }

  async submitMessage(_message: string): Promise<void> {
    // build client
    const accountId = process.env.HCS_ACCOUNT_ID
    const privateKey = process.env.HCS_PRIVATE_KEY

    this.client.setOperator(accountId, privateKey)

    // specify topic id and submit a new message to HCS
    // await new TopicMessageSubmitTransaction()
    //   .setTopicId(this.topicId)
    //   .setMessage(_message)
    //   .execute(this.client)
  }

}

const HederaConsensusService = new _HederaConsensusService()
export default HederaConsensusService
