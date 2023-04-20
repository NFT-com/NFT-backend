import DataLoader from 'dataloader'
import { In } from 'typeorm'

import { _logger, db, entity } from '@nftcom/shared'

const repositories = db.newRepositories()

export const wallet = new DataLoader<string, entity.Wallet>(ids => {
  return repositories.wallet
    .find({
      where: { id: In([...ids]) },
    })
    .then(rows => ids.map(id => rows.find(x => x.id === id)))
})
