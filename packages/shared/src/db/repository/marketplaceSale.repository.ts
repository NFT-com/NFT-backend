import { MarketplaceSale } from '@nftcom/shared/db/entity/marketplaceSale.entity'

import { BaseRepository } from './base.repository'

export class MarketplaceSaleRepository extends BaseRepository<MarketplaceSale> {

  constructor() {
    super(MarketplaceSale)
  }

  public getDistinctContractAddresses = (): Promise<any[]> => {
    return this.getRepository().createQueryBuilder('sales')
      .select('DISTINCT sales.contractAddress')
      .getRawMany()
  }

}
