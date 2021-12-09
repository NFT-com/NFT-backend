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

  let cron1
  let cron2
  let cronRunning = false

  app.get('/health', (req, res) => {
    return res.json(`server up, indexer running = ${cronRunning}`)
  })

  app.get('/start', (req, res) => {
    try {
      if (cron1 && cron2 && cronRunning) {
        return res.json('cron already running')
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
      
        // 3 minutes
        cron2 = cron.schedule(
          '0 */3 * * * *',
          () => {
            getImplementationDetails()
            importMetaData()
            populateTokenIds()
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cronRunning = true
        return res.json('ok')
      }
    } catch (err) {
      return res.json({
        error: err,
      })
    }
  })

  app.get('/stop', (req, res) => {
    try {
      if (cron1 && cron2) {
        cron1.stop()
        cron2.stop()

        cronRunning = false
        return res.json('ok')
      } else {
        return res.json('cron isn\'t running right now')
      }
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