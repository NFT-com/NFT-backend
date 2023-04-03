import { BigNumber, ethers } from 'ethers'
import { SelectQueryBuilder } from 'typeorm'

import { NFTPortTransaction } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class NFTPortTransactionRepository extends BaseRepository<NFTPortTransaction> {
  constructor() {
    super(NFTPortTransaction)
  }

  public findTransactionsByCollection = (
    types: string[],
    contract: string,
    chainId: string,
  ): Promise<NFTPortTransaction[]> => {
    const queryBuilder: SelectQueryBuilder<NFTPortTransaction> =
      this.getRepository(true).createQueryBuilder('transaction')
    if (types.findIndex(type => type === 'all') !== -1) {
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
    } else {
      return queryBuilder
        .where('transaction.nft IS NOT NULL and transaction.nft ::jsonb @> :nft and transaction.type IN (:...types)', {
          nft: {
            contractAddress: ethers.utils.getAddress(contract),
          },
          types,
        })
        .orWhere(
          'transaction.nft IS NULL and transaction.contractAddress = :contractAddress and transaction.type IN (:...types)',
          {
            contractAddress: ethers.utils.getAddress(contract),
            types,
          },
        )
        .andWhere({
          chainId,
        })
        .cache(true)
        .getMany()
    }
  }

  public findTransactionsByNFT = (
    types: string[],
    contract: string,
    tokenId: string,
    chainId: string,
  ): Promise<NFTPortTransaction[]> => {
    const queryBuilder: SelectQueryBuilder<NFTPortTransaction> =
      this.getRepository(true).createQueryBuilder('transaction')
    if (types.findIndex(type => type === 'all') !== -1) {
      return queryBuilder
        .where('transaction.nft IS NOT NULL and transaction.nft ::jsonb @> :nft', {
          nft: {
            contractAddress: ethers.utils.getAddress(contract),
            tokenId: BigNumber.from(tokenId).toHexString(),
          },
        })
        .orWhere(
          'transaction.nft IS NULL and transaction.contractAddress = :contractAddress and transaction.tokenId = :tokenId',
          {
            contractAddress: ethers.utils.getAddress(contract),
            tokenId: BigNumber.from(tokenId).toHexString(),
          },
        )
        .andWhere({
          chainId,
        })
        .cache(true)
        .getMany()
    } else {
      return queryBuilder
        .where('transaction.nft IS NOT NULL and transaction.nft ::jsonb @> :nft and transaction.type IN (:...types)', {
          nft: {
            contractAddress: ethers.utils.getAddress(contract),
            tokenId: BigNumber.from(tokenId).toHexString(),
          },
          types,
        })
        .orWhere(
          'transaction.nft IS NULL and transaction.contractAddress = :contractAddress and transaction.tokenId = :tokenId and transaction.type IN (:...types)',
          {
            contractAddress: ethers.utils.getAddress(contract),
            tokenId: BigNumber.from(tokenId).toHexString(),
            types,
          },
        )
        .andWhere({
          chainId,
        })
        .cache(true)
        .getMany()
    }
  }

  public findSaleListingBidsByNFT = (
    contract: string,
    tokenId: string,
    whereQuery: any,
  ): Promise<NFTPortTransaction[]> => {
    const queryBuilder: SelectQueryBuilder<NFTPortTransaction> =
      this.getRepository(true).createQueryBuilder('transaction')
    return queryBuilder
      .where('transaction.nft IS NOT NULL and transaction.nft ::jsonb @> :nft', {
        nft: {
          contractAddress: ethers.utils.getAddress(contract),
          tokenId: BigNumber.from(tokenId).toHexString(),
        },
      })
      .andWhere(whereQuery)
      .cache(true)
      .getMany()
  }

  public getLatestTxForCollectionOrNFT = (
    chainId: string,
    contract: string,
    tokenId?: string,
  ): Promise<NFTPortTransaction> => {
    const queryBuilder: SelectQueryBuilder<NFTPortTransaction> =
      this.getRepository(true).createQueryBuilder('transaction')
    if (tokenId) {
      return queryBuilder
        .where('transaction.nft IS NOT NULL and transaction.nft ::jsonb @> :nft', {
          nft: {
            contractAddress: ethers.utils.getAddress(contract),
            tokenId: BigNumber.from(tokenId).toHexString(),
          },
        })
        .orWhere(
          'transaction.nft IS NULL and transaction.contractAddress = :contractAddress and transaction.tokenId = :tokenId',
          {
            contractAddress: ethers.utils.getAddress(contract),
            tokenId: BigNumber.from(tokenId).toHexString(),
          },
        )
        .andWhere({
          chainId,
        })
        .orderBy('transaction.transactionDate', 'DESC')
        .cache(true)
        .getOne()
    } else {
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
        .orderBy('transaction.transactionDate', 'DESC')
        .cache(true)
        .getOne()
    }
  }

  public countForCollectionOrNFT = (chainId: string, contract: string, tokenId?: string): Promise<number> => {
    const queryBuilder: SelectQueryBuilder<NFTPortTransaction> =
      this.getRepository(true).createQueryBuilder('transaction')
    if (tokenId) {
      return queryBuilder
        .where('transaction.nft IS NOT NULL and transaction.nft ::jsonb @> :nft', {
          nft: {
            contractAddress: ethers.utils.getAddress(contract),
            tokenId: BigNumber.from(tokenId).toHexString(),
          },
        })
        .orWhere(
          'transaction.nft IS NULL and transaction.contractAddress = :contractAddress and transaction.tokenId = :tokenId',
          {
            contractAddress: ethers.utils.getAddress(contract),
            tokenId: BigNumber.from(tokenId).toHexString(),
          },
        )
        .andWhere({
          chainId,
        })
        .cache(true)
        .getCount()
    } else {
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
        .getCount()
    }
  }
}
