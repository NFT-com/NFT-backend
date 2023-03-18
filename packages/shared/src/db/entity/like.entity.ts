import { Column, Entity, Index, Unique } from 'typeorm'

import { BaseEntity } from './base.entity'

export enum LikeableType {
  Collection = 'Collection',
  NFT = 'NFT',
  Profile = 'Profile',
}

@Entity()
@Index(['likedById', 'likedId', 'likedType'])
@Unique(['likedById', 'likedId', 'likedType'])
export class Like extends BaseEntity {

  @Column()
  likedById: string

  @Column()
  likedId: string

  @Column({ type: 'enum', enum: LikeableType })
  likedType: LikeableType

}