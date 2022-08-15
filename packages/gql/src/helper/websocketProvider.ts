import { ethers, providers, utils } from 'ethers'

import { _logger, contracts, db, helper } from '@nftcom/shared'

const repositories = db.newRepositories()
const nftResolverInterface = new utils.Interface(contracts.NftResolverABI())
const logger = _logger.Factory(_logger.Context.WebsocketProvider, _logger.Context.GraphQL)

type KeepAliveParams = {
  provider: ethers.providers.WebSocketProvider
  chainId: providers.Networkish
  onDisconnect: (err: any) => void
  expectedPongBack?: number
  checkInterval?: number
}

enum EventName {
  AssociateEvmUser = 'AssociateEvmUser',
  CancelledEvmAssociation = 'CancelledEvmAssociation',
  ClearAllAssociatedAddresses = 'ClearAllAssociatedAddresses',
  AssociateSelfWithUser = 'AssociateSelfWithUser',
  RemovedAssociateProfile = 'RemovedAssociateProfile',
}

const keepAlive = ({
  provider,
  chainId,
  onDisconnect,
  expectedPongBack = 15000,
  checkInterval = 7500,
}: KeepAliveParams): Promise<void> => {
  let pingTimeout: NodeJS.Timeout | null = null
  let keepAliveInterval: NodeJS.Timeout | null = null

  provider._websocket.on('open', () => {
    keepAliveInterval = setInterval(() => {
      provider._websocket.ping()

      // Use `WebSocket#terminate()`, which immediately destroys the connection,
      // instead of `WebSocket#close()`, which waits for the close timer.
      // Delay should be equal to the interval at which your server
      // sends out pings plus a conservative assumption of the latency.
      pingTimeout = setTimeout(() => {
        provider._websocket.terminate()
      }, expectedPongBack)
    }, checkInterval)

    // logic for listening and parsing via WSS
    const topicFilter = [
      [
        helper.id('AssociateEvmUser(address,string,address)'),
        helper.id('CancelledEvmAssociation(address,string,address)'),
        helper.id('ClearAllAssociatedAddresses(address,string)'),
        helper.id('AssociateSelfWithUser(address,string,address)'),
        helper.id('RemovedAssociateProfile(address,string,address)'),
      ],
    ]

    const nftResolverAddress = helper.checkSum(
      contracts.nftResolverAddress(Number(chainId).toString()),
    )
    logger.debug(`nftResolverAddress: ${nftResolverAddress}, chainId: ${chainId}`)

    const filter = {
      address: utils.getAddress(nftResolverAddress),
      topics: topicFilter,
    }

    provider.on(filter, async (e) => {
      const evt = nftResolverInterface.parseLog(e)
      logger.debug('******** wss parsed event: ', evt)

      if (evt.name === EventName.AssociateEvmUser) {
        const [owner,profileUrl,destinationAddress] = evt.args
        const event = await repositories.event.findOne({
          where: {
            chainId: Number(chainId),
            contract: helper.checkSum(contracts.nftResolverAddress(Number(chainId))),
            eventName: evt.name,
            txHash: e.transactionHash,
            ownerAddress: owner,
            blockNumber: Number(e.blockNumber),
            profileUrl: profileUrl,
            destinationAddress: helper.checkSum(destinationAddress),
          },
        })
        if (!event) {
          await repositories.event.save(
            {
              chainId: Number(chainId),
              contract: helper.checkSum(contracts.nftResolverAddress(Number(chainId))),
              eventName: evt.name,
              txHash: e.transactionHash,
              ownerAddress: owner,
              blockNumber: Number(e.blockNumber),
              profileUrl: profileUrl,
              destinationAddress: helper.checkSum(destinationAddress),
            },
          )
          logger.debug(`New WSS NFT Resolver ${evt.name} event found. ${ profileUrl } (owner = ${owner}) is associating ${ destinationAddress }. chainId=${chainId}`)
        }
      } else if (evt.name == EventName.CancelledEvmAssociation) {
        const [owner,profileUrl,destinationAddress] = evt.args
        const event = await repositories.event.findOne({
          where: {
            chainId,
            contract: helper.checkSum(contracts.nftResolverAddress(Number(chainId))),
            eventName: evt.name,
            txHash: e.transactionHash,
            ownerAddress: owner,
            blockNumber: Number(e.blockNumber),
            profileUrl: profileUrl,
            destinationAddress: helper.checkSum(destinationAddress),
          },
        })
        if (!event) {
          await repositories.event.save(
            {
              chainId: Number(chainId),
              contract: helper.checkSum(contracts.nftResolverAddress(Number(chainId))),
              eventName: evt.name,
              txHash: e.transactionHash,
              ownerAddress: owner,
              blockNumber: Number(e.blockNumber),
              profileUrl: profileUrl,
              destinationAddress: helper.checkSum(destinationAddress),
            },
          )
          logger.debug(`New WSS NFT Resolver ${evt.name} event found. ${ profileUrl } (owner = ${owner}) is cancelling ${ destinationAddress }. chainId=${chainId}`)
        }
      } else if (evt.name == EventName.ClearAllAssociatedAddresses) {
        const [owner,profileUrl] = evt.args
        const event = await repositories.event.findOne({
          where: {
            chainId: Number(chainId),
            contract: helper.checkSum(contracts.nftResolverAddress(Number(chainId))),
            eventName: evt.name,
            txHash: e.transactionHash,
            ownerAddress: owner,
            blockNumber: Number(e.blockNumber),
            profileUrl: profileUrl,
          },
        })
        if (!event) {
          await repositories.event.save(
            {
              chainId: Number(chainId),
              contract: helper.checkSum(contracts.nftResolverAddress(Number(chainId))),
              eventName: evt.name,
              txHash: e.transactionHash,
              ownerAddress: owner,
              blockNumber: Number(e.blockNumber),
              profileUrl: profileUrl,
            },
          )
          logger.debug(`New NFT Resolver ${evt.name} event found. ${ profileUrl } (owner = ${owner}) cancelled all associations. chainId=${chainId}`)
        }
      } else if (evt.name === EventName.AssociateSelfWithUser ||
        evt.name === EventName.RemovedAssociateProfile) {
        const [receiver, profileUrl, profileOwner]  = evt.args
        const event = await repositories.event.findOne({
          where: {
            chainId: Number(chainId),
            contract: helper.checkSum(contracts.nftResolverAddress(Number(chainId))),
            eventName: evt.name,
            txHash: e.transactionHash,
            ownerAddress: profileOwner,
            blockNumber: Number(e.blockNumber),
            profileUrl: profileUrl,
            destinationAddress: helper.checkSum(receiver),
          },
        })
        if (!event) {
          await repositories.event.save(
            {
              chainId: Number(chainId),
              contract: helper.checkSum(contracts.nftResolverAddress(Number(chainId))),
              eventName: evt.name,
              txHash: e.transactionHash,
              ownerAddress: profileOwner,
              blockNumber: Number(e.blockNumber),
              profileUrl: profileUrl,
              destinationAddress: helper.checkSum(receiver),
            },
          )
          logger.debug(`New NFT Resolver ${evt.name} event found. profileUrl = ${profileUrl} (receiver = ${receiver}) profileOwner = ${[profileOwner]}. chainId=${chainId}`)
        }
      } else {
        // not relevant in our search space
        logger.error('topic hash not covered: ', e.transactionHash)
      }
    })
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider._websocket.on('close', (err: any) => {
    if (keepAliveInterval) clearInterval(keepAliveInterval)
    if (pingTimeout) clearTimeout(pingTimeout)
    onDisconnect(err)
  })

  provider._websocket.on('pong', () => {
    if (pingTimeout) clearInterval(pingTimeout)
  })

  return Promise.resolve()
}

export const start = (
  chainId: providers.Networkish = 1, //mainnet default
): Promise<void> => {
  logger.debug('---------> 🎬 starting websocket')

  const provider = ethers.providers.AlchemyProvider.getWebSocketProvider(
    chainId,
    process.env.ALCHEMY_API_KEY,
  )

  keepAlive({
    provider,
    chainId,
    onDisconnect: (err) => {
      start(chainId)
      logger.error('The ws connection was closed', JSON.stringify(err, null, 2))
    },
  })

  return Promise.resolve()
}
