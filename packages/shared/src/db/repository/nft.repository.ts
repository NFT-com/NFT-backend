import { db } from '@nftcom/shared/db'
import { Collection, NFT, Wallet } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class NFTRepository extends BaseRepository<NFT> {

  constructor() {
    super(NFT)
  }

  findByWalletId(walletId: string, chainId: string): Promise<NFT[]> {
    return this.find({ where: { walletId, chainId } })
  }

  findAllWithRelations(): Promise<NFT[]> {
    return this.getRepository(true)
      .createQueryBuilder('nft')
      .leftJoinAndMapOne('nft.collection',
        Collection, 'collection',
        'nft.contract = collection.contract')
      .leftJoinAndMapOne('nft.wallet',
        Wallet, 'wallet',
        'nft.walletId = wallet.id')
      .getMany()
  }

  findAllWithRelationsByContract(contract: string): Promise<NFT[]> {
    return this.getRepository(true)
      .createQueryBuilder('nft')
      .where({
        contract,
      })
      .leftJoinAndMapOne('nft.collection',
        Collection, 'collection',
        'nft.contract = collection.contract')
      .leftJoinAndMapOne('nft.wallet',
        Wallet, 'wallet',
        'nft.walletId = wallet.id')
      .getMany()
  }

  findDistinctContracts(): Promise<any[]> {
    return this.getRepository(true)
      .createQueryBuilder('nft')
      .select('nft.contract')
      .distinct(true)
      .getRawMany()
  }

  findNFTsWithPreviewLinks(): Promise<NFT[]> {
    return this.getRepository(true)
      .createQueryBuilder('nft')
      .where('nft.previewLink is not null')
      .getMany()
  }

  fetchTraitSummaryData(collectionAddress: string): Promise<any[]> {
    const queryRunner = db.getDataSource(true).createQueryRunner()
    return queryRunner.manager.query(`
    SELECT count(*) as count, (traits.value->>'type') as type, (traits.value->>'value') as value 
    FROM "nft", json_array_elements(nft."metadata"->'traits') as traits 
    WHERE "contract" = $1 
    GROUP BY (traits.value->>'type'), (traits.value->>'value') 
    ORDER BY type ASC, count DESC
    `, [collectionAddress])
  }

}
