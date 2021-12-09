import express from 'express'

import { isProduction, serverPort } from './config'
  
let server
export const start = async (): Promise<void> => {
  const app = express()

  app.get('/', (req, res) => {
    return res.json(`indexer is up at ${new Date().toISOString()}, prod=${isProduction()}`)
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