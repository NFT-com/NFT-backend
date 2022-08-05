import { TxActivity } from '@nftcom/shared/db/entity'
import { ActivityType } from '@nftcom/shared/defs'

import { BaseRepository } from './base.repository'

export class TxActivityRepository extends BaseRepository<TxActivity> {

  constructor() {
    super(TxActivity)
  }

  private getEntityName = (activityType: ActivityType): string => {
    if (activityType === ActivityType.Listing || activityType === ActivityType.Bid) {
      return 'TxOrder'
    }

    if (activityType === ActivityType.Sale || activityType === ActivityType.Transfer) {
      return 'TxTransaction'
    }
    return `Tx${activityType}`
  }

  public findActivitiesByType = (
    activityType: ActivityType,
    chainId: string,
  ): Promise<TxActivity[]> => {
    return this.getRepository().createQueryBuilder('activity')
      .leftJoinAndMapOne(
        `activity.${activityType.toLowerCase()}`, this.getEntityName(activityType),
        'activityType',  'activity.activityTypeId = activityType.id')
      .where({ activityType, chainId })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

  public findActivitiesByWalletId = (
    walletId: string,
    chainId: string,
  ): Promise<TxActivity[]> => {
    return this.getRepository().createQueryBuilder('activity')
      .leftJoinAndMapOne('activity.order', 'TxOrder', 'order',
        'activity.id = order.activityId')
      .leftJoinAndMapOne('activity.cancel', 'TxCancel', 'cancel',
        'activity.id = cancel.activityId')
      .leftJoinAndMapOne('activity.transaction', 'TxTransaction', 'transaction',
        'activity.id = transfer.activityId')
      .where({
        walletId,
        chainId,
      })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

  public findActivitiesByWalletIdAndType = (
    walletId: string,
    activityType: ActivityType,
    chainId: string,
  ): Promise<TxActivity[]> => {
    return this.getRepository().createQueryBuilder('activity')
      .leftJoinAndMapOne(`activity.${activityType.toLowerCase()}`,
        this.getEntityName(activityType), 'activityType',
        'activity.activityTypeId = activityType.id')
      .where({
        activityType,
        walletId,
        chainId,
      })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

}
