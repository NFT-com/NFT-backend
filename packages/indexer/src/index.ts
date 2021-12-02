import axios from 'axios'
import kill from 'kill-port'
import cron from 'node-cron'

import { db, fp } from '@nftcom/shared'

import { dbConfig, serverPort, verifyConfiguration } from './config'
import * as server from './server'

const getEthLogs = async (fromBlock = 'latest', toBlock = 'latest'): Promise<void> => {
  const result = await axios.post(
    `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API}`,
    {
      jsonrpc: '2.0',
      method: 'eth_getLogs',
      params: [{
        fromBlock,
        toBlock,
      }],
      id: 0,
    },
  )

  console.log('results: ', result.data.result.length)
  result.data.result.map(data => {
    const repositories = db.newRepositories()
    const foundContract = repositories.contractInfo.findOne({
      where: {
        contract: data.address,
      },
    })

    console.log('foundContract: ', foundContract)
  })
  // {
  //   address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  //   topics: [Array],
  //   data: '0x00000000000000000000000000000000000000000000000036a62a734b645494',
  //   blockNumber: '0xd178f8',
  //   transactionHash: '0x7018227e04de355fa91fcc7fb115bd1db4facb9f30c711ff56569e72676b9e4c',
  //   transactionIndex: '0x2',
  //   blockHash: '0x7aed47da2d4ff98604ff0d7bca8c839199c5e89b715173d914d59e31e35b5a15',
  //   logIndex: '0x0',
  //   removed: false
  // }
}

const startCron = (): Promise<void> => {
  return cron.schedule(
    '*/4 * * * * *',
    () => {
      getEthLogs()
    },
    {
      scheduled: true,
      timezone: 'America/Chicago',
    },
  )
}

const bootstrap = (): Promise<void> => {
  verifyConfiguration()
  return db.connect(dbConfig)
    .then(() => server.start())
    .then(startCron)
    .then(fp.pause(500))
}

const handleError = (err: Error): void => {
  console.error(err)
  throw err
}

const killPort = (): Promise<unknown> => {
  return kill(serverPort)
    // Without this small delay sometimes it's not killed in time
    .then(fp.pause(500))
    .catch((err: any) => console.log(err))
}

const logGoodbye = (): void => {
  console.log('Cya! Thanks for stopping by.')
}

const cleanExit = (): Promise<void> => {
  return server.stop()
    .then(killPort)
    .then(db.disconnect)
    // .then(job.stopAndDisconnect)
    .then(fp.pause(500))
    .finally(() => {
      logGoodbye()
      process.exit()
    })
}

process.on('SIGINT', cleanExit)
process.on('SIGTERM', cleanExit)

bootstrap().catch(handleError)
