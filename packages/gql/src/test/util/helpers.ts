import { db } from '@nftcom/shared/'

export const clearDB = async (repositories: db.Repository): Promise<void> => {
  const users = await repositories.user.findAll()
  const userIds = users.map((user) => user.id)

  const wallets = await repositories.wallet.findAll()
  const walletIds = wallets.map((wallet) => wallet.id)

  const profiles = await repositories.profile.findAll()
  const profileIds = profiles.map((profile) => profile.id)

  const nfts = await repositories.nft.findAll()
  const nftIds = nfts.map((nft) => nft.id)

  const edges = await repositories.edge.findAll()
  const edgeIds = edges.map((edge) => edge.id)

  const collections = await repositories.collection.findAll()
  const collectionIds = collections.map((collection) => collection.id)

  await repositories.edge.hardDeleteByIds(edgeIds)
  await repositories.collection.hardDeleteByIds(collectionIds)
  await repositories.nft.hardDeleteByIds(nftIds)
  await repositories.profile.hardDeleteByIds(profileIds)
  await repositories.user.hardDeleteByIds(userIds)
  await repositories.wallet.hardDeleteByIds(walletIds)
}
