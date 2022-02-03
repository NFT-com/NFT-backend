import { Column, Entity, Index } from 'typeorm'

import { BaseEntity } from './base.entity'

@Entity()
@Index(['contract'])
export class Collection extends BaseEntity {

  @Column({ nullable: false })
  contract: string

  @Column({ nullable: true })
  name: string

}
