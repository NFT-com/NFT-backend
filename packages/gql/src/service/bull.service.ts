import Bull from 'bull'

import { redisConfig } from '@nftcom/cache'
import { _logger } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const logger = _logger.Factory(_logger.Context.Bull)

export const redis = {
  host: redisConfig.host,
  port: redisConfig.port,
}
const queuePrefix = 'queue'

export const obliterateQueue = async (queueName: string): Promise<string> => {
  try {
    const queue = new Bull(
      queueName, {
        prefix: queuePrefix,
        redis,
      })
    await queue.obliterate({ force: true })
    return 'Job is obliterated.'
  } catch (err) {
    logger.error(`Error in obliterateQueue: ${err}`)
    Sentry.captureMessage(`Error in obliterateQueue: ${err}`)
    throw err
  }
}
