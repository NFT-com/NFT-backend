import { Column, Entity, Index, Unique } from 'typeorm'

import {
  GK_EXPIRATION_YEAR,
  ProfileDisplayType,
  ProfileLayoutType,
  ProfileStatus,
  ProfileViewType,
} from '../../defs'

import { BaseEntity } from './base.entity'

// TODO recheck indexes after some data is available
@Entity()
@Index(['ownerUserId', 'deletedAt', 'createdAt', 'status'])
@Unique(['url', 'chainId'])
@Unique(['tokenId', 'chainId'])
@Unique(['url', 'tokenId'])
export class Profile extends BaseEntity {
  @Index()
  @Column({ nullable: false })
  url: string

  @Column({ nullable: true })
  ownerUserId: string

  @Column({ nullable: true })
  ownerWalletId: string

  @Column({ nullable: true })
  tokenId: string

  @Column({ default: false })
  hideCustomization: boolean

  @Column({
    type: 'enum',
    enum: ProfileStatus,
    nullable: false,
    default: ProfileStatus.Available,
  })
  status: ProfileStatus

  @Column({ nullable: true })
  bannerURL: string

  @Column({ nullable: true })
  photoURL: string

  @Column({ nullable: true })
  description: string

  @Column({ nullable: true })
  gkIconVisible: boolean

  @Column({ nullable: true, default: true })
  nftsDescriptionsVisible: boolean

  @Column({ nullable: true, default: false })
  deployedContractsVisible: boolean

  @Column({ nullable: true, type: 'timestamp with time zone' })
  nftsLastUpdated: Date

  @Column({
    type: 'enum',
    enum: ProfileDisplayType,
    nullable: false,
    default: ProfileDisplayType.NFT,
  })
  displayType: ProfileDisplayType

  @Column({
    type: 'enum',
    enum: ProfileLayoutType,
    nullable: false,
    default: ProfileLayoutType.Default,
  })
  layoutType: ProfileLayoutType

  @Column({ nullable: true, type: 'timestamp with time zone' })
  lastScored: Date

  @Column({ nullable: true, default: 0 })
  visibleNFTs: number

  @Column({ nullable: true })
  chainId: string

  @Column({
    type: 'enum',
    enum: ProfileViewType,
    nullable: false,
    default: ProfileViewType.Gallery,
  })
  profileView: ProfileViewType

  @Column('json', { nullable: true, default: [] })
  associatedAddresses: string[]

  @Column({ nullable: true })
  associatedContract: string

  @Column({ nullable: true, type: 'timestamp with time zone' })
  expireAt: Date

  get isGKMinted(): boolean {
    return this.expireAt?.getFullYear() >= GK_EXPIRATION_YEAR
  }
}
