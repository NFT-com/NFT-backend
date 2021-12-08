import { Column, Entity, Index } from 'typeorm'

import { NFTMetadata, NFTType } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

/**
 * @dev this entity tracks an internal db of NFT contracts
 * @dev a different entity will track trades
 */

@Index(['network', 'contract'])
@Index(['network', 'contract', 'tokenId'], { unique: true })
@Entity()
export class NFTRaw extends BaseEntity {

  // by default, is Ethereum Mainnet
  @Column({ nullable: false })
  network: string

  // smart contract address or program
  @Column({ nullable: false })
  contract: string

  // Ethereum: 721 / 1155
  @Column({ type: 'enum', enum: NFTType, nullable: false })
  type: NFTType

  // tokenID of NFT
  @Column({ nullable: true })
  tokenId: number

  // true if this tokenId has an error
  @Column({ nullable: true })
  error: boolean

  @Column({ nullable: true })
  errorReason: string

  // IPFS hash, or centralized URL
  @Column({ nullable: true })
  metadataURL: string

  // metadata json object
  @Column({ type: 'json', nullable: true })
  metadata: NFTMetadata
  
}
