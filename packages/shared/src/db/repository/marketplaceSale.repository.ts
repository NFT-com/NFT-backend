import { MarketplaceSale } from '../entity/marketplaceSale.entity'
import { BaseRepository } from './base.repository'

export class MarketplaceSaleRepository extends BaseRepository<MarketplaceSale> {
  constructor() {
    super(MarketplaceSale)
  }

  public getDistinctContractAddresses = (): Promise<any[]> => {
    return this.getRepository(true).createQueryBuilder('sales').select('DISTINCT sales.contractAddress').getRawMany()
  }
}
