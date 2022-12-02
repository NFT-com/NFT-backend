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

  /* Currently only used to load data into search engine, so object properties are limited to what is needed */
  findPageWithCollectionAndWallet(cursorContract: string, cursorId: string, limit: number): Promise<any[]> {
    const queryRunner = db.getDataSource(true).createQueryRunner()
    const cursorAndLimit = `
    AND (nft.contract, nft.id) > ($1, $2)
    ORDER BY nft.contract ASC, nft.id ASC LIMIT $3`
    const limitOnly = 'ORDER BY nft.contract ASC, nft.id ASC LIMIT $1'
    return queryRunner.query(`
    WITH parent_collection AS (
      SELECT
        "contract",
        "name"
      FROM
        collection
      WHERE "isSpam" = false
    ),
    parent_wallet AS (
      SELECT
        "id",
        "address",
        "chainName"
      FROM
        wallet
    )
    SELECT
      nft.*,
      row_to_json(parent_collection.*) as collection,
      row_to_json(parent_wallet.*) as wallet,
      COUNT(*) OVER () AS total_count
    FROM
      nft
      JOIN parent_collection ON parent_collection."contract" = nft."contract"
      LEFT JOIN parent_wallet ON parent_wallet."id" = nft."walletId"
      WHERE nft.contract IN (SELECT "contract" from parent_collection)
      AND nft."deletedAt" IS NULL
      ${cursorContract ? cursorAndLimit : limit ? limitOnly: ''}`, [cursorContract, cursorId, limit].filter(x => !!x))
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
    return queryRunner.query(`
    SELECT count(*) as count, (traits.value->>'type') as type, (traits.value->>'value') as value 
    FROM "nft", json_array_elements(nft."metadata"->'traits') as traits 
    WHERE "contract" = $1 
    GROUP BY (traits.value->>'type'), (traits.value->>'value') 
    ORDER BY type ASC, count DESC
    `, [collectionAddress])
  }

}
