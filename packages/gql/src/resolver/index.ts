import { mergeResolvers } from '@graphql-tools/merge'

import approvalResolvers from './approval.resolver'
import bidResolvers from './bid.resolver'
import collectionResolvers from './collection.resolver'
import curationResolvers from './curation.resolver'
import marketAskResolvers from './marketAsk.resolver'
import marketBidResolvers from './marketBid.resolver'
import marketSwapResolvers from './marketSwap.resolver'
import miscResolvers from './misc.resolver'
import nftResolvers from './nft.resolver'
import profileResolvers from './profile.resolver'
import scalarResolvers from './scalar.resolver'
import userResolvers from './user.resolver'
import walletResolvers from './wallet.resolver'

export const resolvers = mergeResolvers([
  scalarResolvers,
  approvalResolvers,
  bidResolvers,
  curationResolvers,
  collectionResolvers,
  marketAskResolvers,
  marketBidResolvers,
  marketSwapResolvers,
  miscResolvers,
  nftResolvers,
  profileResolvers,
  userResolvers,
  walletResolvers,
])
