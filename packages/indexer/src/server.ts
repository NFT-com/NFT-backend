import express from 'express'
import cron from 'node-cron'

import * as Sentry from '@sentry/node'
import * as Tracing from '@sentry/tracing'

import { isProduction, serverPort } from './config'
import { getImplementationDetails, getNftLogs, importMetaData, importMetaDataURL, populateTokenIds } from './index'
  
let server
export const start = async (): Promise<void> => {
  const app = express()

  Sentry.init({
    dsn: 'https://ed3aef052db5446380f4b6e78f538158@o266965.ingest.sentry.io/6103509',
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app }),
    ],
  
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  })
  
  // RequestHandler creates a separate execution context using domains, so that every
  // transaction/span/breadcrumb is attached to its own Hub instance
  app.use(Sentry.Handlers.requestHandler())
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler())

  app.get('/', (req, res) => {
    return res.json(`indexer is up at ${new Date().toISOString()}, prod=${isProduction()}`)
  })

  let cron1, cron1Bool = false
  let cron2, cron2Bool = false
  let cron3, cron3Bool = false
  let cron4, cron4Bool = false
  let cron5, cron5Bool = false

  app.get('/health', (req, res) => {
    return res.json(`server up, cron1=${cron1Bool}, cron2=${cron2Bool}, cron3=${cron3Bool}, cron4=${cron4Bool}, cron5=${cron5Bool}`)
  })

  app.get('/start/:minutes', (req, res) => {
    try {
      if (!cron1 || !cron1Bool) {
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
      }

      if (!cron2 || !cron2Bool) {
        cron2 = cron.schedule(
          `0 */${req.params.minutes} * * * *`,
          () => {
            getImplementationDetails()
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cron2Bool = true
      }

      if (!cron3 || !cron3Bool) {
        cron3 = cron.schedule(
          `0 */${req.params.minutes} * * * *`,
          () => {
            importMetaDataURL()
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cron3Bool = true
      }

      if (!cron4 || !cron4Bool) {
        cron4 = cron.schedule(
          `0 */${req.params.minutes} * * * *`,
          () => {
            importMetaData(50)
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cron4Bool = true
      }

      if (!cron5 || !cron5Bool) {
        cron5 = cron.schedule(
          `0 */${req.params.minutes} * * * *`,
          () => {
            populateTokenIds()
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cron5Bool = true
      }

      return res.json('all start ok')
    } catch (err) {
      return res.json({
        error: err,
      })
    }
  })

  app.get('/1/:minutes', (req, res) => {
    try {
      if (cron1 && cron1Bool) {
        return res.json('nft logs already running')
      } else {
        cron1 = cron.schedule(
          `0 */${req.params.minutes} * * * *`,
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

  app.get('/2/:minutes', (req, res) => {
    try {
      if (cron2 && cron2Bool) {
        return res.json('impDetails already running')
      } else {
        cron2 = cron.schedule(
          `0 */${req.params.minutes} * * * *`,
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

  app.get('/3/:minutes', (req, res) => {
    try {
      if (cron3 && cron3Bool) {
        return res.json('import metadata url already running')
      } else {
        cron3 = cron.schedule(
          `0 */${req.params.minutes} * * * *`,
          () => {
            importMetaDataURL()
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cron3Bool = true
        return res.json('import metadata url ok')
      }
    } catch (err) {
      return res.json({
        error: err,
      })
    }
  })

  app.get('/4/:minutes/:limit', (req, res) => {
    try {
      if (cron4 && cron4Bool) {
        return res.json('import metadata json already running')
      } else {
        cron4 = cron.schedule(
          `0 */${req.params.minutes} * * * *`,
          () => {
            importMetaData(Number(req.params.limit) ?? 50)
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cron4Bool = true
        return res.json('import metadata json ok')
      }
    } catch (err) {
      return res.json({
        error: err,
      })
    }
  })

  app.get('/5/:minutes', (req, res) => {
    try {
      if (cron5 && cron5Bool) {
        return res.json('populate tokenIds already running')
      } else {
        cron5 = cron.schedule(
          `0 */${req.params.minutes} * * * *`,
          () => {
            populateTokenIds()
          },
          {
            scheduled: true,
            timezone: 'America/Chicago',
          },
        )
        cron5Bool = true
        return res.json('populate tokenIds ok')
      }
    } catch (err) {
      return res.json({
        error: err,
      })
    }
  })

  app.get('/stop', (req, res) => {
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

      if (cron5Bool) {
        cron5.stop()

        cron5Bool = false
      }

      return res.json('ok')
    } catch (err) {
      return res.json({
        error: err,
      })
    }
  })

  app.get('/error', () => {
    throw new Error('test error')
  })

  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler())

  // Optional fallthrough error handler
  app.use(function onError(err, req, res) {
    // The error id is attached to `res.sentry` to be returned
    // and optionally displayed to the user for support.
    res.statusCode = 500
    res.end(res.sentry + '\n')
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