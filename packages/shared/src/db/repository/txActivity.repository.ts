import { TxActivity } from '@nftcom/shared/db/entity'
import { ActivityType } from '@nftcom/shared/defs'

import { BaseRepository } from './base.repository'

export class TxActivityRepository extends BaseRepository<TxActivity> {

  constructor() {
    super(TxActivity)
  }

  public findActivitiesByType = (
    foreignType: ActivityType,
  ): Promise<TxActivity[]> => {
    return this.getRepository().find({
      where: {
        foreignType,
        deletedAt: null,
      },
      join: {
        alias: 'a',
        leftJoinAndSelect: {
          'fkId': `a.${foreignType.toLowerCase()}`,
        },
      },
      order: { timestamp: 'DESC' },
    })
  }

  public findActivitiesByUserId = (
    userId: string,
  ): Promise<TxActivity[]> => {
    return this.find({
      where: {
        userId,
        deletedAt: null,
      },
      order: { timestamp: 'DESC' },
      relations: [
        'bid',
        'cancel',
        'listing',
        'sale',
        'transfer',
      ],
    })
  }

  public findActivitiesByUserIdAndType = (
    foreignType: ActivityType,
    userId: string,
  ): Promise<TxActivity[]> => {
    return this.find({
      where: {
        foreignType,
        userId,
        deletedAt: null,
      },
      join: {
        alias: 'a',
        leftJoinAndSelect: {
          'fkId': `a.${foreignType.toLowerCase()}`,
        },
      },
      order: { timestamp: 'DESC' },
    })
  }

}
