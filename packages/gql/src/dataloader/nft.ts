import DataLoader from 'dataloader'
import { LRUMap } from 'lru_map'
import { In } from 'typeorm'

import { _logger, db, entity } from '@nftcom/shared'

const repositories = db.newRepositories()

export const nft = new DataLoader<string, entity.NFT>(
  ids => {
    return repositories.nft
      .find({
        where: { id: In([...ids]) },
      })
      .then(rows => ids.map(id => rows.find(x => x.id === id)))
  },
  {
    cacheMap: new LRUMap(100_000),
  },
)

export const nftsByWalletId = new DataLoader<string, entity.NFT[]>(
  walletIds => {
    return repositories.nft
      .find({
        where: { walletId: In([...walletIds]) },
      })
      .then(rows => {
        return walletIds.map(id => {
          const foundNFTs = rows.filter(nft => nft.walletId === id)
          for (const foundNFT of foundNFTs) {
            nft.clear(foundNFT.id).prime(foundNFT.id, foundNFT)
          }
          return foundNFTs
        })
      })
  },
  {
    cacheMap: new LRUMap(20),
  },
)
