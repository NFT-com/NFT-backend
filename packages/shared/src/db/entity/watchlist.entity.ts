import { Column, Entity } from 'typeorm'

import { BaseEntity } from './base.entity'

@Entity()
export class Watchlist extends BaseEntity {

  @Column({ nullable: false })
  userId: string

  @Column({ nullable: false })
  title: string

}
