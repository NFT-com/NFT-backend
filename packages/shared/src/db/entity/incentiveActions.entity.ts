import { Column, Entity } from 'typeorm'

import { ProfileTask } from '@nftcom/shared/defs'

import { BaseEntity } from '.'

@Entity()
export class IncentiveAction extends BaseEntity {

  @Column({ nullable: false })
  userId: string

  @Column({ nullable: false })
  profileUrl: string

  @Column({ type: 'enum', enum: ProfileTask, nullable: false })
  task: ProfileTask

  @Column({ nullable: false })
  point: number

}
