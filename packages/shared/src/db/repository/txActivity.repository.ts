import { In, UpdateResult } from 'typeorm'

import { TxActivity } from '@nftcom/shared/db/entity'
import { ActivityFilters,ActivityType } from '@nftcom/shared/defs'

import { BaseRepository } from './base.repository'

interface EntityNameAndType {
  name: string
  type: string
}
export class TxActivityRepository extends BaseRepository<TxActivity> {

  constructor() {
    super(TxActivity)
  }

  private getEntityNameAndType = (activityType: ActivityType): EntityNameAndType => {
    if (activityType === ActivityType.Listing || activityType === ActivityType.Bid) {
      return { name: 'TxOrder', type: 'order' }
    }

    if (activityType === ActivityType.Sale || activityType === ActivityType.Transfer) {
      return { name: 'TxTransaction', type: 'transaction' }
    }
    return { name: `Tx${activityType}`, type: `${activityType.toLowerCase()}` }
  }

  public findActivitiesByType = async (
    activityType: ActivityType,
    chainId: string,
  ): Promise<TxActivity[]> => {
    const { name, type } = this.getEntityNameAndType(activityType)
    return this.getRepository().createQueryBuilder('activity')
      .leftJoinAndMapOne(
        `activity.${type}`, name,
        'activityType',  'activity.id = activityType.activityId and activityType.id = activity.activityTypeId')
      .where({ activityType, chainId })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

  public findActivitiesByWalletId = (
    walletId: string,
    chainId: string,
  ): Promise<TxActivity[]> => {
    return this.getRepository().createQueryBuilder('activity')
      .leftJoinAndMapOne('activity.order', 'TxOrder',
        'order', 'activity.id = order.activityId and order.id = activity.activityTypeId')
      .leftJoinAndMapOne('activity.cancel', 'TxCancel',
        'cancel', 'activity.id = cancel.activityId and cancel.id = activity.activityTypeId')
      .leftJoinAndMapOne('activity.transaction', 'TxTransaction',
        'transaction', 'activity.id = transaction.activityId and transaction.id = activity.activityTypeId')
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
    const { name, type } = this.getEntityNameAndType(activityType)
    return this.getRepository().createQueryBuilder('activity')
      .leftJoinAndMapOne(`activity.${type}`,
        name, 'activityType',
        'activity.id = activityType.activityId')
      .where({
        activityType,
        walletId,
        chainId,
      })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

  public findActivities = (condition: ActivityFilters): Promise<TxActivity[]> => {
    return this.getRepository().createQueryBuilder('activity')
      .leftJoinAndMapOne('activity.order', 'TxOrder',
        'order', 'activity.id = order.activityId and order.id = activity.activityTypeId')
      .leftJoinAndMapOne('activity.cancel', 'TxCancel',
        'cancel', 'activity.id = cancel.activityId and cancel.id = activity.activityTypeId')
      .leftJoinAndMapOne('activity.transaction', 'TxTransaction',
        'transaction', 'activity.id = transaction.activityId and transaction.id = activity.activityTypeId')
      .where({
        ...condition,
      })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

  public updateActivities = (
    ids: string[],
    walletAddress: string,
    chainId: string,
  ): Promise<UpdateResult> =>{
    return this.getRepository().createQueryBuilder('activity')
      .update({ read: true })
      .where({
        id: In(ids),
        read: false,
        walletAddress,
        chainId,
      })
      .returning(['id'])
      .updateEntity(true)
      .execute()
  }

}
