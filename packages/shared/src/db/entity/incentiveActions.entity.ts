import { Column, Entity } from 'typeorm'

import { BaseEntity } from '.'

@Entity()
export class IncentiveActionsEntity extends BaseEntity {

  @Column({ nullable: false })
  userId: string

  @Column({ nullable: false })
  profileUrl: string

  @Column({ nullable: false })
  task: string

  @Column({ nullable: false })
  point: number

}
