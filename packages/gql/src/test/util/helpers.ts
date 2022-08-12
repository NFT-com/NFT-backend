import { _logger,db } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)

export const clearDB = async (repositories: db.Repository): Promise<void> => {
  let users = await repositories.user.findAll()
  const userIds = users.map((user) => user.id)

  let wallets = await repositories.wallet.findAll()
  const walletIds = wallets.map((wallet) => wallet.id)

  let profiles = await repositories.profile.findAll()
  const profileIds = profiles.map((profile) => profile.id)

  let nfts = await repositories.nft.findAll()
  const nftIds = nfts.map((nft) => nft.id)

  let edges = await repositories.edge.findAll()
  const edgeIds = edges.map((edge) => edge.id)

  let collections = await repositories.collection.findAll()
  const collectionIds = collections.map((collection) => collection.id)

  let events = await repositories.event.findAll()
  const eventIds = events.map((event) => event.id)
  if (edgeIds.length) await repositories.edge.hardDeleteByIds(edgeIds)
  if (collectionIds.length) await repositories.collection.hardDeleteByIds(collectionIds)
  if (nftIds.length) await repositories.nft.hardDeleteByIds(nftIds)
  if (profileIds.length) await repositories.profile.hardDeleteByIds(profileIds)
  if (userIds.length) await repositories.user.hardDeleteByIds(userIds)
  if (walletIds.length) await repositories.wallet.hardDeleteByIds(walletIds)
  if (eventIds.length) await repositories.event.hardDeleteByIds(eventIds)

  users = await repositories.user.findAll()
  wallets = await repositories.wallet.findAll()
  profiles = await repositories.profile.findAll()
  nfts = await repositories.nft.findAll()
  edges = await repositories.edge.findAll()
  collections = await repositories.collection.findAll()
  events = await repositories.event.findAll()
  if (users.length || wallets.length || profiles.length ||
    nfts.length || edges.length || collections.length || events.length
  ) {
    logger.error('Failed to clear test DB')
  }
}
