import { mergeResolvers } from '@graphql-tools/merge'

import approvalResolvers from './approval.resolver'
import bidResolvers from './bid.resolver'
import collectionResolvers from './collection.resolver'
import contractDataResolver from './contractData.resolver'
import curationResolvers from './curation.resolver'
import likeResolver from './like.resolver'
import marketSwapResolvers from './marketSwap.resolver'
import miscResolvers from './misc.resolver'
import nftResolvers from './nft.resolver'
import profileResolvers from './profile.resolver'
import scalarResolvers from './scalar.resolver'
import tradingResolvers from './trading.resolver'
import txActivityResolvers from './txActivity.resolver'
import userResolvers from './user.resolver'
import walletResolvers from './wallet.resolver'
import watchlistResolvers from './watchlist.resolver'

export const resolvers: any = mergeResolvers([
  scalarResolvers,
  approvalResolvers,
  bidResolvers,
  curationResolvers,
  collectionResolvers,
  contractDataResolver,
  tradingResolvers,
  likeResolver,
  marketSwapResolvers,
  miscResolvers,
  nftResolvers,
  profileResolvers,
  txActivityResolvers,
  userResolvers,
  walletResolvers,
  watchlistResolvers,
])
