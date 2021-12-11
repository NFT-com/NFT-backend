import { Approval } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class ApprovalRepository extends BaseRepository<Approval> {

  constructor() {
    super(Approval)
  }

  public findMaxNFTApprovalByUserId = (userId: string): Promise<Approval> => {
    // TODO: use actual contract address helper
    const nftTokenAddress = '0x4DE2fE09Bc8F2145fE12e278641d2c93B9D4393A'
    return this.findOne({
      where: {
        userId,
        deletedAt: null,
        currency: nftTokenAddress,
      },
      order: { amount: 'DESC' },
    })
  }

}
