import kill from 'kill-port'

import { serverPort, verifyConfiguration } from '@src/config'
import { db } from '@src/db'
import { server } from '@src/graphql'
import { fp } from '@src/helper'

const bootstrap = (): Promise<void> => {
  verifyConfiguration()
  return db.connect()
    .then(() => server.start())
    .then(fp.pause(500))
    // .then(blockchain.createProviders)
    // .then(job.startAndListen)
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
