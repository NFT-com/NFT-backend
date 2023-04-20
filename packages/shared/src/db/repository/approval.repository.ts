import { nftTokenAddress } from '../../helper/contracts'
import { Approval } from '../entity'
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
