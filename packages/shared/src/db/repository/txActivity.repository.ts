import {  In, Not, SelectQueryBuilder, UpdateResult } from 'typeorm'

import { TxActivity } from '@nftcom/shared/db/entity'
import { ActivityFilters, ActivityType, PageableQuery, PageableResult } from '@nftcom/shared/defs'

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

  public findActivitiesByWalletAddress = (
    walletAddress: string,
    chainId: string,
  ): Promise<TxActivity[]> => {
    return this.getRepository().createQueryBuilder('activity')
      .leftJoinAndMapOne('activity.order', 'TxOrder',
        'order', 'activity.id = order.activityId and order.id = activity.activityTypeId')
      .leftJoinAndMapOne('activity.cancel', 'TxCancel',
        'cancel', 'activity.id = cancel.activityId and cancel.id = activity.activityTypeId')
      .where({
        walletAddress,
        chainId,
      })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

  public findActivitiesByWalletAddressAndType = (
    walletAddress: string,
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
        walletAddress,
        chainId,
      })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

  public findActivities = (query: PageableQuery<TxActivity>)
  : Promise<PageableResult<TxActivity>> => {
    const queryBuilder: SelectQueryBuilder<TxActivity> = this.getRepository()
      .createQueryBuilder('activity')
    const { nftIds, remainingFilters } = query.filters.reduce(
      (aggregator: any, filter: TxActivity) => {
        const { nftId, ...remaingFilters } = filter
        if (nftId) {
          aggregator.nftIds.push(nftId)
        }

        if (Object.keys(remaingFilters).length) {
          aggregator.remainingFilters.push(remaingFilters)
        }
        return aggregator
      }, { nftIds: [], remainingFilters: [] })
    queryBuilder
      .where(remainingFilters)

    if (nftIds.length) {
      queryBuilder
        .andWhere('activity.nftId @> ARRAY[:...nftId]', { nftId: nftIds })
    }

    return queryBuilder
      .orderBy(query.orderBy)
      .take(query.take)
      .leftJoinAndMapOne('activity.order', 'TxOrder',
        'order', 'activity.id = order.activityId and order.id = activity.activityTypeId')
      .leftJoinAndMapOne('activity.transaction', 'TxTransaction',
        'transaction', 'activity.id = transaction.activityId and transaction.id = activity.activityTypeId')
      .cache(true)
      .leftJoinAndMapOne('activity.cancel', 'TxCancel',
        'cancel', 'activity.id = cancel.activityId and cancel.id = activity.activityTypeId')
      .cache(true)
      .getManyAndCount()
  }

  public updateActivities = (
    ids: string[],
    filters: ActivityFilters,
    updateField: string,
    updateValue: any,
  ): Promise<UpdateResult> =>{
    let queryFilter: any = {
      ...filters,
      [updateField]: Not(updateValue),
    }

    if (ids.length) {
      queryFilter = { ...queryFilter, id: In(ids) }
    }

    let updates: any = { [updateField]: updateValue }
    if (updateField === 'read') {
      updates = { ...updates, readTimestamp: new Date() }
    }
    return this.getRepository().createQueryBuilder('activity')
      .update(updates)
      .where(queryFilter)
      .returning(['id'])
      .updateEntity(true)
      .execute()
  }

}
