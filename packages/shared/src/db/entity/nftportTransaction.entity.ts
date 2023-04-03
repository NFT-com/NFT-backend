import { Column, Entity, Index } from 'typeorm'

import { NFTPortMarketplace, NFTPortNFTType, NFTPortPriceType } from '@nftcom/shared/defs'

import { BaseEntity } from '.'

@Entity()
@Index(['type', 'transactionDate', 'contractAddress'])
@Index(['marketplace'])
@Index(['type', 'contractAddress', 'tokenId', 'transactionHash', 'blockNumber', 'blockHash', 'chainId'])
export class NFTPortTransaction extends BaseEntity {
  // transaction type - list, cancel_list, mint, sale, burn, transfer, bid, cancel_bid
  @Column({ nullable: false })
  type: string

  @Column({ nullable: true })
  listerAddress: string

  @Column({ nullable: true })
  ownerAddress: string

  @Column({ nullable: true })
  contractAddress: string

  @Column({ nullable: true })
  tokenId: string

  @Column({ nullable: true })
  quantity: number

  @Column({ nullable: true })
  transactionHash: string

  @Column({ nullable: true })
  blockHash: string

  @Column({ nullable: true })
  blockNumber: string

  @Column({ nullable: true })
  transferFrom: string

  @Column({ nullable: true })
  transferTo: string

  @Column({ nullable: true })
  buyerAddress: string

  @Column({ nullable: true })
  sellerAddress: string

  @Column({ type: 'enum', enum: NFTPortMarketplace, nullable: true })
  marketplace: NFTPortMarketplace

  @Column({ nullable: true })
  bidderAddress: string

  /*
   *  @Index() -- Manually added to migration indexNFTPortTxNFT1675360976823
   *  because Typeorm does not support GIN index required for json types
   *  array is set to false, otherwise, typeorm will assume it to be json[] and not allow jsonb_set operations
   */
  @Column({ type: 'jsonb', array: false, nullable: true })
  nft: NFTPortNFTType

  @Column({ type: 'json', nullable: true })
  priceDetails: NFTPortPriceType

  @Column({ nullable: false, type: 'timestamp with time zone' })
  transactionDate: Date

  @Column({ nullable: true })
  chainId: string
}
