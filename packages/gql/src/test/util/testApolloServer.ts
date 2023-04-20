import { ApolloServer } from 'apollo-server-express'

import { defs } from '@nftcom/shared'

import { User, Wallet } from '../../defs/gql'
import { rateLimitedSchema } from '../../schema'
import { createLoaders, formatError } from '../../server'

export function getTestApolloServer(
  testDB: any,
  user?: User,
  wallet?: Wallet,
  chain?: defs.Chain,
  teamKey?: string,
): ApolloServer {
  return new ApolloServer({
    schema: rateLimitedSchema(),
    introspection: true,
    context: () => {
      return {
        network: 'ethereum',
        chain: chain ?? { id: '5', name: 'goerli' },
        user: user ?? null,
        wallet: wallet ?? null,
        repositories: testDB,
        teamKey: teamKey ?? null,
        loaders: createLoaders(),
      }
    },
    formatError,
  })
}
