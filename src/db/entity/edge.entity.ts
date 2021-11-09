import { Column, Entity, Index } from 'typeorm'

import { misc } from '@src/defs'

import { BaseEntity } from './base.entity'

@Index(['collectionId', 'edgeType', 'thatEntityId', 'thisEntityId'], { unique: true })
@Index(['collectionId', 'edgeType', 'deletedAt', 'createdAt'])
@Index(['collectionId', 'edgeType', 'thatEntityType', 'deletedAt'])
@Index(['collectionId', 'edgeType', 'thatEntityType', 'thatEntityId', 'deletedAt'])
@Index(['thisEntityId', 'edgeType', 'deletedAt', 'createdAt'])
@Index(['thatEntityId', 'edgeType', 'deletedAt', 'createdAt'])
@Index(['thisEntityId', 'thatEntityId', 'edgeType', 'deletedAt'])
@Entity()
export class Edge extends BaseEntity {

  // multiple edges can have the same collectionId+thisEntityId combination
  @Column({ nullable: true })
  collectionId: string

  @Column({ nullable: false })
  thisEntityId: string

  @Column({ type: 'enum', enum: misc.EntityType, nullable: false })
  thisEntityType: misc.EntityType

  @Column({ nullable: false })
  thatEntityId: string

  @Column({ type: 'enum', enum: misc.EntityType, nullable: false })
  thatEntityType: misc.EntityType

  @Column({ type: 'enum', enum: misc.EdgeType })
  edgeType: misc.EdgeType

}
