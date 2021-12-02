import { Column, Entity } from 'typeorm'

import { BaseEntity } from './base.entity'

@Entity()
export class ContractInfo extends BaseEntity {

  @Column({ nullable: false })
  network: string

  @Column({ nullable: false })
  contract: string

  @Column({ nullable: false })
  abi: string

}
