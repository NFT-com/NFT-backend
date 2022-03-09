import { Column, Entity } from 'typeorm'

import { BaseEntity } from './base.entity'

@Entity()
export class WatchlistItem extends BaseEntity {

  @Column({ nullable: false })
  inWatchlist: string

  @Column({ nullable: false })
  itemId: string

}
