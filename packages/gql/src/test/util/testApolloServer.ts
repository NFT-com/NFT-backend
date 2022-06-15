import { ApolloServer } from 'apollo-server-express'

import { rateLimitedSchema } from '@nftcom/gql/schema'
import { formatError } from '@nftcom/gql/server'

export function getTestApolloServer(
  testDB: any,
): ApolloServer {
  return new ApolloServer({
    schema: rateLimitedSchema(),
    introspection: true,
    context: () => {
      return {
        network: 'ethereum',
        chain: '4',
        wallet: null,
        user: null,
        repositories: testDB,
      }
    },
    formatError,
  })
}