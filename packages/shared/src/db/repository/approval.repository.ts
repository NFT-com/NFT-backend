import { Approval } from '@nftcom/shared/db/entity'
import { nftTokenAddress } from '@nftcom/shared/helper/contracts'

import { BaseRepository } from './base.repository'

export class ApprovalRepository extends BaseRepository<Approval> {

  constructor() {
    super(Approval)
  }

  public findMaxNFTApprovalByUserId = (userId: string, chainId: string | number = 'mainnet'): Promise<Approval> => {
    return this.findOne({
      where: {
        userId,
        deletedAt: null,
        currency: nftTokenAddress(chainId),
      },
      order: { amount: 'DESC' },
    })
  }

}
