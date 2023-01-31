import { BigNumber, ethers } from 'ethers'
import { SelectQueryBuilder } from 'typeorm'

import { NFTPortTransaction } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class NFTPortTransactionRepository extends BaseRepository<NFTPortTransaction> {

  constructor() {
    super(NFTPortTransaction)
  }

  public findTransactionsByCollection = (
    contract: string,
    chainId: string,
  ): Promise<NFTPortTransaction[]> => {
    const queryBuilder: SelectQueryBuilder<NFTPortTransaction> = this.getRepository(true)
      .createQueryBuilder('transaction')
    return queryBuilder.where('transaction.nft IS NOT NULL')
      .andWhere('transaction.nft ::jsonb @> :nft', {
        nft: {
          contractAddress: ethers.utils.getAddress(contract),
        },
      })
      .andWhere({
        chainId,
      })
      .cache(true)
      .getMany()
  }

  public findTransactionsByNFT = (
    contract: string,
    tokenId: string,
    chainId: string,
  ): Promise<NFTPortTransaction[]> => {
    const queryBuilder: SelectQueryBuilder<NFTPortTransaction> = this.getRepository(true)
      .createQueryBuilder('transaction')
    return queryBuilder.where('transaction.nft IS NOT NULL')
      .andWhere('transaction.nft ::jsonb @> :nft', {
        nft: {
          contractAddress: ethers.utils.getAddress(contract),
          tokenId: BigNumber.from(tokenId).toHexString(),
        },
      })
      .andWhere({
        chainId,
      })
      .cache(true)
      .getMany()
  }

}
