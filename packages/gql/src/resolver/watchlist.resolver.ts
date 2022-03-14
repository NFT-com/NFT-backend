// import { BigNumber, ContractReceipt, ContractTransaction, utils, Wallet } from 'ethers'
// import { combineResolvers } from 'graphql-resolvers'
// import Joi from 'joi'

// import { Context, gql } from '@nftcom/gql/defs'
// import { appError, mintError, profileError } from '@nftcom/gql/error'
// import { auth, joi } from '@nftcom/gql/helper'
// import { core } from '@nftcom/gql/service'
// import { _logger, contracts, defs, entity, fp, helper, provider, typechain } from '@nftcom/shared'

// const logger = _logger.Factory(_logger.Context.Watchlist, _logger.Context.GraphQL)

// const addToWatchlist = (_: any, args: gql.MutationAddToWatchlistArgs, ctx: Context,): Promise<gql.Watchlist> => {
//   const { user } = ctx
//   logger.debug('addToWatchlist', { loggedInUserId: user.id, input: args })

// }

// const createWatchEdge = (ctx: Context) => {
//   const { user, repositories } = ctx

//   return repositories.edge.exists({

//   })
// }

// export default {
//   Query: {
//     // watchlist: fnc

//     // e.g. myProfiles: combineResolvers(auth.isAuthenticated, getMyProfiles),
//   },
//   Mutation: {
//     // addToWatchlist: fnc
//     // deleteFromWatchlist: fnc

//     // e.g. followProfile: combineResolvers(auth.isAuthenticated, followProfile),
//   },
// }
