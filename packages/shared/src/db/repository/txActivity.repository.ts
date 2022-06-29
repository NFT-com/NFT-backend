import { TxActivity } from '@nftcom/shared/db/entity'
import { ActivityType } from '@nftcom/shared/defs'

import { BaseRepository } from './base.repository'

export class TxActivityRepository extends BaseRepository<TxActivity> {

  constructor() {
    super(TxActivity)
  }

  public findActivityByType = (
    foreignType: ActivityType,
  ): Promise<TxActivity> => {
    return this.findOne({
      where: {
        foreignType,
        deletedAt: null,
      },
      order: { timestamp: 'DESC' },
    })
  }

  public findActivityByUserId = (
    userId: string,
  ): Promise<TxActivity> => {
    return this.findOne({
      where: {
        userId,
        deletedAt: null,
      },
      order: { timestamp: 'DESC' },
    })
  }

  public findActivityByUserIdAndType = (
    foreignType: ActivityType,
    userId: string,
  ): Promise<TxActivity> => {
    return this.findOne({
      where: {
        foreignType,
        userId,
        deletedAt: null,
      },
      order: { timestamp: 'DESC' },
    })
  }

}
