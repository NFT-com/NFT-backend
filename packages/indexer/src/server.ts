import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageProductionDefault,
} from 'apollo-server-core'
import { ApolloServer } from 'apollo-server-express'
import express from 'express'
import http from 'http'

import { resolvers } from '@nftcom/gql/resolver'
import { typeDefs } from '@nftcom/gql/schema'
import { helper } from '@nftcom/shared'

import { isProduction, serverPort } from './config'
  
let server: ApolloServer
export const start = async (): Promise<void> => {
  const playground = isProduction()
    ? ApolloServerPluginLandingPageProductionDefault()
    : ApolloServerPluginLandingPageGraphQLPlayground()
  
  const app = express()

  app.get('/', (req, res) => {
    return res.json(`indexer is up at ${new Date().toISOString()}`)
  })

  const httpServer = http.createServer(app)
  server = new ApolloServer({
    introspection: helper.isFalse(isProduction()),
    typeDefs: typeDefs(),
    resolvers: resolvers,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      playground,
    ],
  })
  await server.start()
  server.applyMiddleware({ app })
  await new Promise<void>(resolve => httpServer.listen({ port: serverPort }, resolve))
  console.log(`🚀 Server ready at http://localhost:${serverPort}${server.graphqlPath}`)
}
  
export const stop = (): Promise<void> => {
  if (!server) {
    return
  }
  return server.stop()
}