import { Column, Entity, Index } from 'typeorm'

import { EdgeType, EntityType } from '@src/defs'

import { Base } from './base.entity'

@Index(['collectionId', 'edgeType', 'thatEntityId', 'thisEntityId'], { unique: true })
@Index(['collectionId', 'edgeType', 'deletedAt', 'createdAt'])
@Index(['collectionId', 'edgeType', 'thatEntityType', 'deletedAt'])
@Index(['collectionId', 'edgeType', 'thatEntityType', 'thatEntityId', 'deletedAt'])
@Index(['thisEntityId', 'edgeType', 'deletedAt', 'createdAt'])
@Index(['thatEntityId', 'edgeType', 'deletedAt', 'createdAt'])
@Index(['thisEntityId', 'thatEntityId', 'edgeType', 'deletedAt'])
@Entity()
export class Edge extends Base {

  // multiple edges can have the same collectionId+thisEntityId combination
  @Column({ nullable: true })
  collectionId: string

  @Column({ nullable: false })
  thisEntityId: string

  @Column({ type: 'enum', enum: EntityType, nullable: false })
  thisEntityType: EntityType

  @Column({ nullable: false })
  thatEntityId: string

  @Column({ type: 'enum', enum: EntityType, nullable: false })
  thatEntityType: EntityType

  @Column({ type: 'enum', enum: EdgeType })
  edgeType: EdgeType

}
