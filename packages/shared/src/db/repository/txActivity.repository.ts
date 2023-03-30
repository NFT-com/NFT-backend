import * as _lodash from 'lodash'
import { In, LessThanOrEqual, MoreThan, MoreThanOrEqual, Not, SelectQueryBuilder, UpdateResult } from 'typeorm'

import { NFT, TxActivity } from '@nftcom/shared/db/entity'
import {
  ActivityFilters,
  ActivityStatus,
  ActivityType,
  PageableQuery,
  PageableResult,
  ProtocolType,
} from '@nftcom/shared/defs'

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

  public findActivitiesByType = async (activityType: ActivityType, chainId: string): Promise<TxActivity[]> => {
    const { name, type } = this.getEntityNameAndType(activityType)
    return this.getRepository(true)
      .createQueryBuilder('activity')
      .leftJoinAndMapOne(
        `activity.${type}`,
        name,
        'activityType',
        'activity.id = activityType.activityId and activityType.id = activity.activityTypeId',
      )
      .where({ activityType, chainId })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

  public findActivitiesByWalletAddress = (walletAddress: string, chainId: string): Promise<TxActivity[]> => {
    return this.getRepository(true)
      .createQueryBuilder('activity')
      .leftJoinAndMapOne(
        'activity.order',
        'TxOrder',
        'order',
        'activity.id = order.activityId and order.orderHash = activity.activityTypeId',
      )
      .leftJoinAndMapOne(
        'activity.cancel',
        'TxCancel',
        'cancel',
        'activity.id = cancel.activityId and cancel.transactionHash = activity.activityTypeId',
      )
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
    return this.getRepository(true)
      .createQueryBuilder('activity')
      .leftJoinAndMapOne(`activity.${type}`, name, 'activityType', 'activity.id = activityType.activityId')
      .where({
        activityType,
        walletAddress,
        chainId,
      })
      .orderBy({ timestamp: 'DESC' })
      .getMany()
  }

  // activities for filters - pageable result
  public findActivities = (
    query: PageableQuery<TxActivity>,
    protocol?: ProtocolType,
  ): Promise<PageableResult<TxActivity>> => {
    const queryBuilder: SelectQueryBuilder<TxActivity> = this.getRepository(true).createQueryBuilder('activity')
    const { nftIds, remainingFilters } = query.filters.reduce(
      (aggregator: any, filter: TxActivity) => {
        const { nftId, ...remainingFilters } = filter
        if (nftId) {
          aggregator.nftIds.push(nftId)
        }

        if (Object.keys(remainingFilters).length) {
          aggregator.remainingFilters.push(remainingFilters)
        }
        return aggregator
      },
      { nftIds: [], remainingFilters: [] },
    )
    queryBuilder.where(remainingFilters)

    if (nftIds.length) {
      queryBuilder.andWhere('activity.nftId @> ARRAY[:...nftId]', { nftId: nftIds })
    }

    if (protocol) {
      return queryBuilder
        .orderBy(query.orderBy)
        .take(query.take)
        .leftJoinAndMapOne(
          'activity.order',
          'TxOrder',
          'order',
          'activity.id = order.activityId and order.orderHash = activity.activityTypeId and order.protocol = :protocol',
          { protocol },
        )
        .leftJoinAndMapOne(
          'activity.transaction',
          'TxTransaction',
          'transaction',
          'activity.id = transaction.activityId and transaction.transactionHash = activity.activityTypeId and transaction.protocol = :protocol',
          { protocol },
        )
        .leftJoinAndMapOne(
          'activity.cancel',
          'TxCancel',
          'cancel',
          'activity.id = cancel.activityId and cancel.transactionHash = activity.activityTypeId and cancel.exchange = :protocol',
          { protocol },
        )
        .cache(true)
        .getManyAndCount()
    } else {
      return queryBuilder
        .orderBy(query.orderBy)
        .take(query.take)
        .leftJoinAndMapOne(
          'activity.order',
          'TxOrder',
          'order',
          'activity.id = order.activityId and order.orderHash = activity.activityTypeId',
        )
        .leftJoinAndMapOne(
          'activity.transaction',
          'TxTransaction',
          'transaction',
          'activity.id = transaction.activityId and transaction.transactionHash = activity.activityTypeId',
        )
        .leftJoinAndMapOne(
          'activity.cancel',
          'TxCancel',
          'cancel',
          'activity.id = cancel.activityId and cancel.transactionHash = activity.activityTypeId',
        )
        .cache(true)
        .getManyAndCount()
    }
  }

  // activities for collection
  public findActivitiesForCollection = (
    contract: string,
    activityTypes: ActivityType[],
    protocol?: string,
  ): Promise<TxActivity[]> => {
    const queryBuilder: SelectQueryBuilder<TxActivity> = this.getRepository(true).createQueryBuilder('activity')

    if (protocol) {
      return queryBuilder
        .where({
          nftContract: contract,
          activityType: In(activityTypes),
          status: ActivityStatus.Valid,
        })
        .orderBy({ 'activity.updatedAt': 'DESC' })
        .leftJoinAndMapOne(
          'activity.order',
          'TxOrder',
          'order',
          'activity.id = order.activityId and order.orderHash = activity.activityTypeId and order.protocol = :protocol',
          { protocol },
        )
        .leftJoinAndMapOne(
          'activity.transaction',
          'TxTransaction',
          'transaction',
          'activity.id = transaction.activityId and transaction.transactionHash = activity.activityTypeId and transaction.protocol = :protocol',
          { protocol },
        )
        .leftJoinAndMapOne(
          'activity.cancel',
          'TxCancel',
          'cancel',
          'activity.id = cancel.activityId and cancel.transactionHash = activity.activityTypeId and cancel.exchange = :protocol',
          { protocol },
        )
        .cache(true)
        .getMany()
    } else {
      return queryBuilder
        .where({
          nftContract: contract,
          activityType: In(activityTypes),
          status: ActivityStatus.Valid,
        })
        .orderBy({ 'activity.updatedAt': 'DESC' })
        .leftJoinAndMapOne(
          'activity.order',
          'TxOrder',
          'order',
          'activity.id = order.activityId and order.orderHash = activity.activityTypeId',
        )
        .leftJoinAndMapOne(
          'activity.transaction',
          'TxTransaction',
          'transaction',
          'activity.id = transaction.activityId and transaction.transactionHash = activity.activityTypeId',
        )
        .leftJoinAndMapOne(
          'activity.cancel',
          'TxCancel',
          'cancel',
          'activity.id = cancel.activityId and cancel.transactionHash = activity.activityTypeId',
        )
        .cache(true)
        .getMany()
    }
  }

  // activities for NFT
  public findActivitiesForNFT = (
    contract: string,
    tokenId: string,
    activityTypes: ActivityType[],
    protocol?: string,
  ): Promise<TxActivity[]> => {
    const nftId = `ethereum/${contract}/${tokenId}`

    const queryBuilder: SelectQueryBuilder<TxActivity> = this.getRepository(true).createQueryBuilder('activity')

    if (protocol) {
      return queryBuilder
        .where({
          nftContract: contract,
          activityType: In(activityTypes),
          status: ActivityStatus.Valid,
        })
        .andWhere('activity.nftId @> ARRAY[:nftId]', { nftId })
        .orderBy({ 'activity.updatedAt': 'DESC' })
        .leftJoinAndMapOne(
          'activity.order',
          'TxOrder',
          'order',
          'activity.id = order.activityId and order.orderHash = activity.activityTypeId and order.protocol = :protocol',
          { protocol },
        )
        .leftJoinAndMapOne(
          'activity.transaction',
          'TxTransaction',
          'transaction',
          'activity.id = transaction.activityId and transaction.transactionHash = activity.activityTypeId and transaction.protocol = :protocol',
          { protocol },
        )
        .leftJoinAndMapOne(
          'activity.cancel',
          'TxCancel',
          'cancel',
          'activity.id = cancel.activityId and cancel.transactionHash = activity.activityTypeId and cancel.exchange = :protocol',
          { protocol },
        )
        .cache(true)
        .getMany()
    } else {
      return queryBuilder
        .where({
          nftContract: contract,
          activityType: In(activityTypes),
          status: ActivityStatus.Valid,
        })
        .andWhere('activity.nftId @> ARRAY[:nftId]', { nftId })
        .orderBy({ 'activity.updatedAt': 'DESC' })
        .leftJoinAndMapOne(
          'activity.order',
          'TxOrder',
          'order',
          'activity.id = order.activityId and order.orderHash = activity.activityTypeId',
        )
        .leftJoinAndMapOne(
          'activity.transaction',
          'TxTransaction',
          'transaction',
          'activity.id = transaction.activityId and transaction.transactionHash = activity.activityTypeId',
        )
        .leftJoinAndMapOne(
          'activity.cancel',
          'TxCancel',
          'cancel',
          'activity.id = cancel.activityId and cancel.transactionHash = activity.activityTypeId',
        )
        .cache(true)
        .getMany()
    }
  }

  // activities for NFT
  public findActivitiesForNFTs = (
    nfts: NFT[],
    activityType: ActivityType,
    opts?: {
      notExpired?: boolean
      expiredOnly?: boolean
      activityStatus?: ActivityStatus
    },
  ): Promise<TxActivity[]> => {
    const nftIds = nfts.map((nft: NFT) => `ethereum/${nft.contract}/${nft.tokenId}`)

    const queryBuilder: SelectQueryBuilder<TxActivity> = this.getRepository(true).createQueryBuilder('activity')

    return queryBuilder
      .where({
        activityType,
        status: opts.activityStatus || ActivityStatus.Valid,
        expiration: opts.notExpired ? MoreThan(new Date()) : opts.expiredOnly ? LessThanOrEqual(new Date()) : undefined,
      })
      .andWhere('activity.nftId && ARRAY[:...nftIds]', { nftIds })
      .orderBy({ 'activity.updatedAt': 'DESC' })
      .leftJoinAndMapOne(
        'activity.order',
        'TxOrder',
        'order',
        'activity.id = order.activityId and order.orderHash = activity.activityTypeId',
      )
      .cache(true)
      .getMany()
  }

  public findActivitiesNotExpired = (
    activityType: ActivityType,
    opts: {
      nftContract?: string
      updatedAt?: Date
    },
  ): Promise<TxActivity[]> => {
    const queryBuilder: SelectQueryBuilder<TxActivity> = this.getRepository(true).createQueryBuilder('activity')

    const { nftContract, updatedAt } = opts

    const queryObj = {
      activityType,
      nftContract,
      status: ActivityStatus.Valid,
      expiration: MoreThan(new Date()),
      updatedAt: MoreThanOrEqual(updatedAt),
    }
    if (!updatedAt) {
      delete queryObj['updatedAt']
    }
    if (!nftContract) {
      delete queryObj['nftContract']
    }
    return queryBuilder
      .where(queryObj)
      .orderBy({ 'activity.updatedAt': 'DESC' })
      .innerJoinAndMapOne('activity.order', 'TxOrder', 'order', 'activity.id = order.activityId')
      .cache(true)
      .getMany()
  }

  public updateActivities = (
    ids: string[],
    filters: ActivityFilters,
    updateField: string,
    updateValue: any,
  ): Promise<UpdateResult> => {
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
    return this.getRepository()
      .createQueryBuilder('activity')
      .update(updates)
      .where(queryFilter)
      .returning(['id'])
      .updateEntity(true)
      .execute()
  }

  public findActivitiesWithEmptyNFT = (activityType: ActivityType): Promise<TxActivity[]> => {
    const queryBuilder: SelectQueryBuilder<TxActivity> = this.getRepository(true).createQueryBuilder('activity')

    const queryObj = {
      activityType,
      nftId: [],
    }
    return queryBuilder
      .where(queryObj)
      .orderBy({ 'activity.updatedAt': 'DESC' })
      .leftJoinAndMapOne(
        'activity.transaction',
        'TxTransaction',
        'transaction',
        'activity.id = transaction.activityId and transaction.transactionHash = activity.activityTypeId',
      )
      .cache(true)
      .getMany()
  }

}
