import { In, SelectQueryBuilder } from 'typeorm'

import { TxOrder } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class TxOrderRepository extends BaseRepository<TxOrder> {

  constructor() {
    super(TxOrder)
  }

  public findOrdersByHashes = (orderHashes: string[], chainId: string): Promise<TxOrder[]> => {
    const queryBuilder: SelectQueryBuilder<TxOrder> = this.getRepository(true)
      .createQueryBuilder('order')
  
    return queryBuilder
      .where({ orderHash: In(orderHashes), chainId })
      .orderBy({ 'order.createdAt': 'DESC' })
      .leftJoinAndSelect('order.protocolData', 'protocolData')
      .cache(true)
      .getMany()
  }
  
}
