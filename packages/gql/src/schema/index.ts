import { gql } from 'apollo-server-express'
import fs from 'fs'
import { DocumentNode, GraphQLSchema } from 'graphql'
import { rateLimitDirective } from 'graphql-rate-limit-directive'
import path from 'path'
import { RateLimiterMemory } from 'rate-limiter-flexible'

import { makeExecutableSchema } from '@graphql-tools/schema'
import { _logger } from '@nftcom/shared'

import { resolvers } from '../resolver'

const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)

const readGraphQLFile = (file: string): string => {
  const filePath = path.join(__dirname, file)
  return fs.readFileSync(filePath, 'utf-8')
}

const gqlWrapper = (...files: any): DocumentNode => {
  return gql`
    ${files}
  `
}

export const typeDefs = (): DocumentNode => {
  const filesContent = fs
    .readdirSync(__dirname)
    .filter(file => path.extname(file) === '.graphql')
    .map(readGraphQLFile)
  return gqlWrapper(...filesContent)
}

export const rateLimitedSchema = (): GraphQLSchema => {
  const keyGenerator = (directiveArgs, source, args, context): string => `${context.user?.id}`

  class DebugRateLimiterMemory extends RateLimiterMemory {

    consume(key, pointsToConsume, options): any {
      logger.debug(`[CONSUME] ${key} for ${pointsToConsume}`)
      return super.consume(key, pointsToConsume, options)
    }
  
  }

  const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
    keyGenerator,
    limiterClass: DebugRateLimiterMemory,
  })

  const schemaInput = makeExecutableSchema({
    typeDefs: [
      rateLimitDirectiveTypeDefs,
      `
      type Mutation {
        signHash(input: SignHashInput!): SignHashOutput @rateLimit(limit: 1, duration: 15)
      }
      `,
      `
      type Mutation {
        refreshNft(id: ID!): NFT! @rateLimit(limit: 1, duration: 5)
      }
      `,
      typeDefs(),
    ],
    resolvers,
  })
  return rateLimitDirectiveTransformer(schemaInput)
}
