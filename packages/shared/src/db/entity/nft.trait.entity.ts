import { Column, Entity, Index, PrimaryColumn } from 'typeorm'

import { NFTTrait } from '@nftcom/shared/defs'

// TODO recheck indexes after some data is available
@Entity()
@Index(['nftId'])
export class NftTrait {

  @PrimaryColumn()
  id: string

  @Column({ nullable: false })
  nftId: string

  @Column({ type: 'json', nullable: false })
  trait: NFTTrait

}
