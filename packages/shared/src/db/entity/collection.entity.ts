import { Column, Entity, Index, Unique } from 'typeorm'

import { BaseEntity } from './base.entity'

@Entity()
@Index(['contract'])
@Unique(['contract'])
export class Collection extends BaseEntity {

  @Column({ nullable: false })
  contract: string

  @Column({ nullable: true })
  name: string

  @Column({ nullable: true })
  chainId: string

}
