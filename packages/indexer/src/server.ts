import express from 'express'
import cron from 'node-cron'

import { isProduction, serverPort } from './config'
import { getImplementationDetails, getNftLogs, importMetaData, populateTokenIds } from './index'
  
let server
export const start = async (): Promise<void> => {
  const app = express()

  app.get('/', (req, res) => {
    return res.json(`indexer is up at ${new Date().toISOString()}, prod=${isProduction()}`)
  })

  let cron1, cron1Bool = false
  let cron2, cron2Bool = false
  let cron3, cron3Bool = false
  let cron4, cron4Bool = false

  app.get('/health', (req, res) => {
    return res.json(`server up, cron1=${cron1Bool}, cron2=${cron2Bool}, cron3=${cron3Bool}, cron4=${cron4Bool}`)
  })

  app.get('/start1', (req, res) => {
    try {
      if (cron1 && cron1Bool) {
        return res.json('nft logs already running')
      } else {
        cron1 = cron.schedule(
          '0 */1 * * * *',
          () => {
            getNftLogs()
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cron1Bool = true
        return res.json('nft logs ok')
      }
    } catch (err) {
      return res.json({
        error: err,
      })
    }
  })

  app.get('/start2', (req, res) => {
    try {
      if (cron2 && cron2Bool) {
        return res.json('impDetails already running')
      } else {
        cron2 = cron.schedule(
          '0 */1 * * * *',
          () => {
            getImplementationDetails()
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cron2Bool = true
        return res.json('impDetails ok')
      }
    } catch (err) {
      return res.json({
        error: err,
      })
    }
  })

  app.get('/start3', (req, res) => {
    try {
      if (cron3 && cron3Bool) {
        return res.json('import metadata already running')
      } else {
        cron3 = cron.schedule(
          '0 */1 * * * *',
          () => {
            importMetaData()
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cron3Bool = true
        return res.json('import metadata ok')
      }
    } catch (err) {
      return res.json({
        error: err,
      })
    }
  })

  app.get('/start4', (req, res) => {
    try {
      if (cron4 && cron4Bool) {
        return res.json('populate tokenIds already running')
      } else {
        cron4 = cron.schedule(
          '0 */1 * * * *',
          () => {
            populateTokenIds()
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cron4Bool = true
        return res.json('populate tokenIds ok')
      }
    } catch (err) {
      return res.json({
        error: err,
      })
    }
  })

  app.get('/stop-all', (req, res) => {
    try {
      if (cron1Bool) {
        cron1.stop()

        cron1Bool = false
      }

      if (cron2Bool) {
        cron2.stop()

        cron2Bool = false
      }

      if (cron3Bool) {
        cron3.stop()

        cron3Bool = false
      }

      if (cron4Bool) {
        cron4.stop()

        cron4Bool = false
      }

      return res.json('ok')
    } catch (err) {
      return res.json({
        error: err,
      })
    }
  })

  server = app.listen(serverPort, () => {
    console.log(`Listening to port ${serverPort}`)
  })
}
  
export const stop = (): Promise<void> => {
  if (!server) {
    return
  }
  return server.stop()
}