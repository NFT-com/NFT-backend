import { TxActivity } from '@nftcom/shared/db/entity'
import { ActivityType } from '@nftcom/shared/defs'

import { BaseRepository } from './base.repository'

export class TxActivityRepository extends BaseRepository<TxActivity> {

  constructor() {
    super(TxActivity)
  }

  private getEntityName = (activityType: ActivityType): string => {
    if (activityType === ActivityType.Listing) {
      return 'TxList'
    }
    return `Tx${activityType}`
  }

  public findActivitiesByType = (
    activityType: ActivityType,
  ): Promise<TxActivity[]> => {
    return this.getRepository().createQueryBuilder('activity')
      .leftJoinAndMapOne(
        `activity.${activityType.toLowerCase()}`, this.getEntityName(activityType),
        'activityType',  'activity.activityTypeId = activityType.id')
      .where({ activityType })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

  public findActivitiesByUserId = (
    userId: string,
  ): Promise<TxActivity[]> => {
    return this.getRepository().createQueryBuilder('activity')
      .leftJoinAndMapOne('activity.bid', 'TxBid', 'bid',
        'activity.activityTypeId = bid.id AND activity.id = bid.activityId')
      .leftJoinAndMapOne('activity.cancel', 'TxCancel', 'cancel',
        'activity.activityTypeId = cancel.id AND activity.id = cancel.activityId')
      .leftJoinAndMapOne('activity.listing', 'TxList', 'list',
        'activity.activityTypeId = list.id AND activity.id = list.activityId')
      .leftJoinAndMapOne('activity.sale', 'TxSale', 'sale',
        'activity.activityTypeId = sale.id AND activity.id = sale.activityId')
      .leftJoinAndMapOne('activity.transfer', 'TxTransfer', 'transfer',
        'activity.activityTypeId = transfer.id AND activity.id = transfer.activityId')
      .where({
        userId,
      })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

  public findActivitiesByUserIdAndType = (
    userId: string,
    activityType: ActivityType,
  ): Promise<TxActivity[]> => {
    return this.getRepository().createQueryBuilder('activity')
      .leftJoinAndMapOne(`activity.${activityType.toLowerCase()}`,
        this.getEntityName(activityType), 'activityType',
        'activity.activityTypeId = activityType.id')
      .where({
        activityType,
        userId,
      })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

}
