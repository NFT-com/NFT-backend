import { Column, Entity, Index } from 'typeorm'

import { BaseEntity } from './base.entity'

@Index(['network', 'contract', 'bool721', 'bool1155'], { unique: true })
@Entity()
export class ContractInfo extends BaseEntity {

  @Column({ nullable: false })
  network: string

  @Column({ nullable: false })
  contract: string

  // these are nullable since we can run extended queries at a later time
  @Column({ nullable: true })
  bool721: boolean

  @Column({ nullable: true })
  bool1155: boolean

  @Column({ nullable: true })
  contractName: string

  @Column({ nullable: true })
  abi: string

  // optional fields for implementation contracts
  @Column({ nullable: true })
  proxy: boolean

  @Column({ nullable: true })
  implementation: string

  @Column({ nullable: true })
  implementationAbi: string

  @Column({ nullable: true })
  implementationName: string

}
