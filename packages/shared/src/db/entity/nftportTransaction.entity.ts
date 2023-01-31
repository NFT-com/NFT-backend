import { Column, Entity, Index } from 'typeorm'

import { BaseEntity } from '.'

@Entity()
@Index(['type', 'transactionAt', 'contractAddress'])
export class NFTPortTransactionEntity extends BaseEntity {

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
  transactionDate: string

  @Column({ nullable: true })
  transferFrom: string

  @Column({ nullable: true })
  transferTo: string

  @Column({ nullable: true })
  buyerAddress: string

  @Column({ nullable: true })
  sellerAddress: string

  @Column({ nullable: true })
  marketplace: string

  @Column({ nullable: true })
  bidderAddress : string

  @Column({ type: 'json', nullable: true })
  nft: any

  @Column({ type: 'json', nullable: true })
  priceDetails: any

  @Column({ nullable: true, type: 'timestamp with time zone' })
  transactionAt: string

}
