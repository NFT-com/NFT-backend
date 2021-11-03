import { mergeResolvers } from '@graphql-tools/merge'

import approvalResolvers from './approval.resolver'
import bidResolvers from './bid.resolver'
import nftResolvers from './nft.resolver'
import profileResolvers from './profile.resolver'
import userResolvers from './user.resolver'
import walletResolvers from './wallet.resolver'

export const resolvers = mergeResolvers([
  approvalResolvers,
  bidResolvers,
  nftResolvers,
  profileResolvers,
  userResolvers,
  walletResolvers,
])
