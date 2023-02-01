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
    return queryBuilder
      .where('transaction.nft IS NOT NULL and transaction.nft ::jsonb @> :nft', {
        nft: {
          contractAddress: ethers.utils.getAddress(contract),
        },
      })
      .orWhere('transaction.nft IS NULL and transaction.contractAddress = :contractAddress', {
        contractAddress: ethers.utils.getAddress(contract),
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
    return queryBuilder
      .where('transaction.nft IS NOT NULL and transaction.nft ::jsonb @> :nft', {
        nft: {
          contractAddress: ethers.utils.getAddress(contract),
          tokenId: BigNumber.from(tokenId).toHexString(),
        },
      })
      .orWhere('transaction.nft IS NULL and transaction.contractAddress = :contractAddress and transaction.tokenId = :tokenId', {
        contractAddress: ethers.utils.getAddress(contract),
        tokenId: BigNumber.from(tokenId).toHexString(),
      })
      .andWhere({
        chainId,
      })
      .cache(true)
      .getMany()
  }

}
