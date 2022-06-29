import { Column, Entity } from 'typeorm'

import { ExchangeType } from '@nftcom/shared/defs'

import { TxTransferBaseEntity } from './txTransferBase.entity'

@Entity()
export class TxSale extends TxTransferBaseEntity {
  
  @Column({ type: 'enum', enum: ExchangeType, nullable: false })
  exchange: ExchangeType
  
  @Column({ nullable: false })
  price: string

  @Column({ nullable: false })
  currency: string

}
