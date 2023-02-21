import { SelectQueryBuilder } from 'typeorm'

import { TxTransaction } from '@nftcom/shared/db/entity'
import { ActivityStatus, ActivityType, ProtocolType } from '@nftcom/shared/defs'

import { BaseRepository } from './base.repository'

export class TxTransactionRepository extends BaseRepository<TxTransaction> {

  constructor() {
    super(TxTransaction)
  }

  public findRecipientActivitiesForSale = (
    address: string,
    status: ActivityStatus,
    protocol?: ProtocolType,
  ): Promise<TxTransaction[]> => {
    const queryBuilder: SelectQueryBuilder<TxTransaction> = this.getRepository(true)
      .createQueryBuilder('tx')
    if (protocol ) {
      return queryBuilder
        .where({ transactionType: ActivityType.Sale, taker: address, protocol })
        .orderBy({ 'tx.createdAt': 'DESC' })
        .leftJoinAndSelect('tx.activity', 'activity', 'activity.status = :status', { status })
        .leftJoinAndMapOne('activity.transaction', 'TxTransaction',
          'transaction', 'activity.id = transaction.activityId and transaction.transactionHash = activity.activityTypeId')
        .cache(true)
        .getMany()
    } else {
      return queryBuilder
        .where({ transactionType: ActivityType.Sale, taker: address })
        .orderBy({ 'tx.createdAt': 'DESC' })
        .leftJoinAndSelect('tx.activity', 'activity', 'activity.status = :status', { status })
        .leftJoinAndMapOne('activity.transaction', 'TxTransaction',
          'transaction', 'activity.id = transaction.activityId and transaction.transactionHash = activity.activityTypeId')
        .cache(true)
        .getMany()
    }
  }

}
