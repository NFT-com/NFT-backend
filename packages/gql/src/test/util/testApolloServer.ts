import { ApolloServer } from 'apollo-server-express'

import { User, Wallet } from '@nftcom/gql/defs/gql'
import { rateLimitedSchema } from '@nftcom/gql/schema'
import { formatError } from '@nftcom/gql/server'
import { defs } from '@nftcom/shared'

export function getTestApolloServer(
  testDB: any,
  user?: User,
  wallet?: Wallet,
  chain?: defs.Chain,
): ApolloServer {
  return new ApolloServer({
    schema: rateLimitedSchema(),
    introspection: true,
    context: () => {
      return {
        network: 'ethereum',
        chain: chain ?? { id: '4', name: 'rinkeby' },
        user: user ?? null,
        wallet: wallet ?? null,
        repositories: testDB,
      }
    },
    formatError,
  })
}
