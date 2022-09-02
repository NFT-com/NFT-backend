import { BigNumber, ethers, providers, utils } from 'ethers'
import { In, LessThan } from 'typeorm'

import { _logger, contracts, db, defs, entity,helper } from '@nftcom/shared'

const repositories = db.newRepositories()
const nftResolverInterface = new utils.Interface(contracts.NftResolverABI())
const looksrareExchangeInterface = new utils.Interface(contracts.looksrareExchangeABI())
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

enum LooksrareEventName {
  CancelAllOrders = 'CancelAllOrders',
  CancelMultipleOrders = 'CancelMultipleOrders',
  TakerAsk = 'TakerAsk',
  TakerBid = 'TakerBid'
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

    const looksrareExchangeAddress = helper.checkSum(
      contracts.looksrareExchangeAddress(chainId.toString()),
    )

    logger.debug(`looksrareExchangeAddress: ${looksrareExchangeAddress}, chainId: ${chainId}`)

    // logic for listening and parsing via WSS
    const looksrareTopicFilter = [
      [
        helper.id('CancelAllOrders(address, uint256)'),
        helper.id('CancelMultipleOrders(address,uint256[])'),
        helper.id('TakerAsk(bytes32,uint256,address,address,address,address,address,uint256,uint256,uint256)'),
        helper.id('TakerBid(bytes32,uint256,address,address,address,address,address,uint256,uint256,uint256)'),
      ],
    ]

    const looksrareFilter = {
      address: utils.getAddress(looksrareExchangeAddress),
      topics: looksrareTopicFilter,
    }

    provider.on(looksrareFilter, async (e) => {
      const evt = looksrareExchangeInterface.parseLog(e)
      if (evt.name === LooksrareEventName.CancelAllOrders) {
        const [user, newMinNonce] = evt.args
        try {
          const orders: entity.TxOrder[] = await repositories.txOrder.find({
            where: {
              makerAddress: helper.checkSum(user),
              nonce: LessThan(newMinNonce),
              activity: {
                status: defs.ActivityStatus.Valid,
              },
            },
          })

          if (orders.length) {
            for (const order of orders) {
              order.activity.status = defs.ActivityStatus.Cancelled
            }

            await repositories.txOrder.saveMany(orders)
            logger.debug(`Evt Saved: ${LooksrareEventName.CancelAllOrders} -- txhash: ${e.transactionHash}`)
          }
        } catch (err) {
          logger.error(`Evt: ${LooksrareEventName.CancelAllOrders} -- Err: ${err}`)
        }
      } else if (evt.name === LooksrareEventName.CancelMultipleOrders) {
        const [user, orderNonces] = evt.args
        const nonces: number[] = orderNonces?.map((orderNonce: BigNumber) => Number(orderNonce))
        try {
          const orders: entity.TxOrder[] = await repositories.txOrder.find({
            relations: ['activity'],
            where: {
              makerAddress: helper.checkSum(user),
              nonce: In(nonces),
              exchange: defs.ExchangeType.LooksRare,
              activity: {
                status: defs.ActivityStatus.Valid,
              },
            },
          })
  
          if (orders.length) {
            for (const order of orders) {
              order.activity.status = defs.ActivityStatus.Cancelled
            }
  
            await repositories.txOrder.saveMany(orders)
            logger.debug(`Evt Saved: ${LooksrareEventName.CancelMultipleOrders} -- txhash: ${e.transactionHash}`)
          }
        } catch (err) {
          logger.error(`Evt: ${LooksrareEventName.CancelMultipleOrders} -- Err: ${err}`)
        }
      } else if (evt.name === LooksrareEventName.TakerAsk) {
        const [orderHash, orderNonce, taker, maker, strategy, currency, collection] = evt.args
        try {
          const order: entity.TxOrder = await repositories.txOrder.findOne({
            relations: ['activity'],
            where: {
              chainId: String(chainId),
              id: orderHash,
              makerAddress: helper.checkSum(maker),
              exchange: defs.ExchangeType.LooksRare,
              protocol: defs.ProtocolType.LooksRare,
              activity: {
                status: defs.ActivityStatus.Valid,
                nftContract: helper.checkSum(collection),
              },
            },
          })
      
          if (order) {
            order.activity.status = defs.ActivityStatus.Executed
            order.takerAddress = helper.checkSum(taker)
            await repositories.txOrder.save(order)
            logger.log(`
                updated ${orderHash} for collection ${collection} -- strategy:
                ${strategy}, currency:${currency} orderNonce:${orderNonce}
                `)
          }
        } catch (err) {
          logger.error(`Evt: ${LooksrareEventName.TakerAsk} -- Err: ${err}`)
        }
      } else if (evt.name === LooksrareEventName.TakerBid) {
        const [orderHash, orderNonce, taker, maker, strategy, currency, collection] = evt.args
        try {
          const order: entity.TxOrder = await repositories.txOrder.findOne({
            relations: ['activity'],
            where: {
              chainId: String(chainId),
              id: orderHash,
              makerAddress: helper.checkSum(maker),
              exchange: defs.ExchangeType.LooksRare,
              protocol: defs.ProtocolType.LooksRare,
              activity: {
                status: defs.ActivityStatus.Valid,
                nftContract: helper.checkSum(collection),
              },
            },
          })
  
          if (order) {
            order.activity.status = defs.ActivityStatus.Executed
            order.takerAddress = helper.checkSum(taker)
            await repositories.txOrder.save(order)
            logger.log(`
            updated ${orderHash} for collection ${collection} -- strategy:
            ${strategy}, currency:${currency} orderNonce:${orderNonce}
            `)
          }
        } catch (err) {
          logger.error(`Evt: ${LooksrareEventName.TakerBid} -- Err: ${err}`)
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
  logger.debug(`---------> 🎬 starting websocket on chainId: ${Number(chainId)}`)

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
