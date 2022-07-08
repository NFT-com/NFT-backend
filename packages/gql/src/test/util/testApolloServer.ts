import { ApolloServer } from 'apollo-server-express'

import { User, Wallet } from '@nftcom/gql/defs/gql'
import { rateLimitedSchema } from '@nftcom/gql/schema'
import { formatError } from '@nftcom/gql/server'

export function getTestApolloServer(
  testDB: any,
  user?: User,
  wallet?: Wallet,
): ApolloServer {
  return new ApolloServer({
    schema: rateLimitedSchema(),
    introspection: true,
    context: () => {
      return {
        network: 'ethereum',
        chain: '4',
        user: user ?? null,
        wallet: wallet ?? null,
        repositories: testDB,
      }
    },
    formatError,
  })
}