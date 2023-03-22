import { Column, Entity } from 'typeorm'

import { BaseEntity } from './base.entity'

export enum ViewableType {
  Collection = 'Collection',
  NFT = 'NFT',
  Profile = 'Profile',
}

@Entity()
export class View extends BaseEntity {

  @Column()
  viewerId: string

  @Column()
  viewedId: string

  @Column({ type: 'enum', enum: ViewableType })
  viewedType: ViewableType

}