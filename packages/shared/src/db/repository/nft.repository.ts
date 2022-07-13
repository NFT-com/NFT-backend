import { Collection, NFT, Wallet } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class NFTRepository extends BaseRepository<NFT> {

  constructor() {
    super(NFT)
  }

  findByWalletId(walletId: string): Promise<NFT[]> {
    return this.find({ where: { walletId } })
  }

  findAllWithRelations(): Promise<NFT[]> {
    return this.getRepository()
      .createQueryBuilder('nft')
      .leftJoinAndMapOne('nft.collection',
        Collection, 'collection',
        'nft.contract = collection.contract')
      .leftJoinAndMapOne('nft.wallet',
        Wallet, 'wallet',
        'nft.walletId = wallet.id')
      .getMany()
  }

  findDistinctContracts(): Promise<any[]> {
    return this.getRepository()
      .createQueryBuilder('nft')
      .select('nft.contract')
      .distinct(true)
      .getRawMany()
  }

}
