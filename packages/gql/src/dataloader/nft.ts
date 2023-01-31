import DataLoader from 'dataloader'
import { LRUMap } from 'lru_map'
import { In } from 'typeorm'

import { _logger, db, entity } from '@nftcom/shared'

const repositories = db.newRepositories()

export const nft = new DataLoader<string, entity.NFT>((ids) => {
  return repositories.nft.find({
    where: { id: In([...ids]) },
  }).then((rows) => ids.map((id) => rows.find((x) => x.id === id)))
}, {
  cacheMap: new LRUMap(100_000),
})

export const nftByWalletId = new DataLoader<string, entity.NFT>((walletIds) => {
  return repositories.nft.find({
    where: { walletId: In([...walletIds]) },
  }).then((rows) => {
    return walletIds.map((id) => {
      const row = rows.find((x) => x.id === id)
      nft.clear(row.id).prime(row.id, row)
      return row
    })
  })
}, {
  cacheMap: new LRUMap(1000),
})