import { Column, Entity, Index } from 'typeorm'

import { Base } from './base.entity'

@Index(['chainId', 'address', 'network'],{ unique: true })
@Entity()
export class Wallet extends Base {

  @Index()
  @Column({ nullable: false })
    userId: string

  @Column({ nullable: false })
    chainId: string

  @Column({ nullable: false })
    chainName: string

  @Column({ nullable: false })
    network: string

  @Column({ nullable: false })
    address: string

}
