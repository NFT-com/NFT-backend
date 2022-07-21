import { exec } from 'child_process'
import kill from 'kill-port'
import * as util from 'util'

import { _logger, db, fp, helper } from '@nftcom/shared'

import { dbConfig, serverPort, verifyConfiguration } from './config'
import { job } from './job'
import * as server from './server'
import HederaConsensusService from './service/hedera.service'
import { setupTracing } from './tracer'

setupTracing(`${process.env.NODE_ENV}-gql`)

const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)

const execShellCommand = (
  command: string,
  swallowError = false,
  description: string,
): Promise<void> => {
  const promisifiedExec = util.promisify(exec)
  return promisifiedExec(command)
    .then(({ stdout, stderr }) => {
      const err = stderr.replace('\n', '').trim()
      if (helper.isNotEmpty(err) && helper.isFalse(swallowError)) {
        return Promise.reject(new Error(`Something went wrong with command ${command}. Error: ${err}`))
      }
      if (helper.isNotEmpty(err) && swallowError) {
        logger.error('SWALLOWING ERROR', err)
        return Promise.resolve()
      }
      logger.info(description, stdout.replace('\n', '').trim())
      return Promise.resolve()
    })
}

const bootstrap = (): Promise<void> => {
  verifyConfiguration()

  return db.connect(dbConfig)
    .then(() => HederaConsensusService.subscribe())
    .then(() => server.start())
    .then(() => job.startAndListen())
    // document watcher for local 
    .then(() => {
      if (process.env.NODE_ENV === 'local') {
        return Promise.resolve(execShellCommand('npm run gqldoc', true, '📚 GQL Documentation:'))
      }
      return Promise.resolve()
    })
    .then(fp.pause(500))
}

const handleError = (err: Error): void => {
  logger.error(err)
  throw err
}

const killPort = (): Promise<unknown> => {
  return kill(serverPort)
    // Without this small delay sometimes it's not killed in time
    .then(fp.pause(500))
    .catch((err: any) => logger.error(err))
}

const logGoodbye = (): void => {
  logger.info('Cya! Thanks for stopping by.')
}

const cleanExit = (): Promise<void> => {
  return server.stop()
    .then(() => HederaConsensusService.unsubscribe())
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

process.on('SIGINT', cleanExit)
process.on('SIGTERM', cleanExit)

bootstrap().catch(handleError)
