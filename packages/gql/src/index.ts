import kill from 'kill-port'

import { db, fp } from '@nftcom/shared'

import { dbConfig, serverPort, verifyConfiguration } from './config'
import { job } from './job'
import * as server from './server'
import HederaConsensusService from './service/hedera.service'

const bootstrap = (): Promise<void> => {
  verifyConfiguration()
  return db.connect(dbConfig)
    .then(() => server.start())
    .then(() => job.startAndListen())
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
  HederaConsensusService.unsubscribe()
  return server.stop()
    .then(killPort)
    .then(() => job.stopAndDisconnect())
    .then(db.disconnect)
    // .then(job.stopAndDisconnect)
    .then(fp.pause(500))
    .finally(() => {
      logGoodbye()
      process.exit()
    })
}

// subscribe to HCS to retrieve and log submitted messages
HederaConsensusService.subscribe()

process.on('SIGINT', cleanExit)
process.on('SIGTERM', cleanExit)

bootstrap().catch(handleError)
