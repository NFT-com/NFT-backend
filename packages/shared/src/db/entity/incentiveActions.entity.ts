import { Column, Entity, Unique } from 'typeorm'

import { ProfileTask } from '../../defs'

import { BaseEntity } from '.'

@Entity()
@Unique(['userId', 'profileUrl', 'task'])
export class IncentiveAction extends BaseEntity {
  @Column({ nullable: true })
  userId: string

  @Column({ nullable: false })
  profileUrl: string

  @Column({ type: 'enum', enum: ProfileTask, nullable: false })
  task: ProfileTask

  @Column({ nullable: false })
  point: number
}
