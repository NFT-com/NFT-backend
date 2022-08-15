import { ethers, providers } from 'ethers'

import { _logger } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.WebsocketProvider, _logger.Context.GraphQL)

type KeepAliveParams = {
  provider: ethers.providers.WebSocketProvider
  onDisconnect: (err: any) => void
  expectedPongBack?: number
  checkInterval?: number
};

const keepAlive = ({
  provider,
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

    // TODO: add logic for listening via WSS
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
    onDisconnect: (err) => {
      start(chainId)
      logger.error('The ws connection was closed', JSON.stringify(err, null, 2))
    },
  })

  return Promise.resolve()
}
