import { mergeResolvers } from '@graphql-tools/merge'

import approvalResolvers from './approval.resolver'
import bidResolvers from './bid.resolver'
import collectionResolvers from './collection.resolver'
import curationResolvers from './curation.resolver'
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
  miscResolvers,
  nftResolvers,
  profileResolvers,
  userResolvers,
  walletResolvers,
])
