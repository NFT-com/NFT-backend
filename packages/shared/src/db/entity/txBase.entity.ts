import { Column, Entity } from 'typeorm'

import { ExchangeType } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

@Entity()
export class TxBaseEntity extends BaseEntity {

  @Column({ type: 'enum', enum: ExchangeType, nullable: false })
  exchange: ExchangeType

}
