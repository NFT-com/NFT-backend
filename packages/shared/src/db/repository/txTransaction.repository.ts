import { SelectQueryBuilder } from 'typeorm'

import { TxTransaction } from '@nftcom/shared/db/entity'
import { ActivityType } from '@nftcom/shared/defs'

import { BaseRepository } from './base.repository'

export class TxTransactionRepository extends BaseRepository<TxTransaction> {

  constructor() {
    super(TxTransaction)
  }

  public findSaleActivities = (
    address: string,
  ): Promise<TxTransaction[]> => {
    const queryBuilder: SelectQueryBuilder<TxTransaction> = this.getRepository(true)
      .createQueryBuilder('transaction')
    return queryBuilder
      .where({ transactionType: ActivityType.Sale, maker: address })
      .orWhere({ transactionType: ActivityType.Sale, taker: address })
      .orderBy({ 'transaction.updatedAt': 'DESC' })
      .leftJoinAndSelect('transaction.activity', 'activity')
      .cache(true)
      .getMany()
  }

}
