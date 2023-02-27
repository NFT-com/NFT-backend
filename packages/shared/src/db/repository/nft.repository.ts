import { db } from '@nftcom/shared/db'
import { Collection, NFT, Wallet } from '@nftcom/shared/db/entity'
import { ProfileSearchNFT } from '@nftcom/shared/defs'

import { BaseRepository } from './base.repository'

export class NFTRepository extends BaseRepository<NFT> {

  constructor() {
    super(NFT)
  }

  findByWalletId(walletId: string, chainId: string): Promise<NFT[]> {
    return this.find({ where: { walletId, chainId } })
  }

  /* Currently only used to load data into search engine, so object properties are limited to what is needed */
  findPageWithCollectionAndWallet(
    cursorContract: string,
    cursorId: string,
    limit: number,
    isSingleContract?: boolean): Promise<any[]> {
    const queryRunner = db.getDataSource(true).createQueryRunner()
    const cursorAndLimit = `
    AND (nft.contract, nft.id) > ($1, $2)
    ORDER BY nft.contract ASC, nft.id ASC LIMIT $3`
    const limitOnly = `ORDER BY nft.contract ASC, nft.id ASC LIMIT ${isSingleContract ? '$2' : '$1'}`
    return queryRunner.query(`
    SELECT
      nft.*,
      row_to_json(collection.*) as collection,
      row_to_json(wallet.*) as wallet,
      COUNT(*) OVER () AS total_count
    FROM
      nft
      LEFT JOIN collection ON collection."contract" = nft."contract"
      LEFT JOIN wallet ON wallet."id" = nft."walletId"
      WHERE nft."deletedAt" IS NULL
      ${isSingleContract ? 'AND nft."contract" = $1' : ''}
      ${cursorContract && cursorId ? cursorAndLimit : limit ? limitOnly: ''}`, [cursorContract, cursorId, limit].filter(x => !!x))
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

  findByEdgeProfileDisplays(
    profileId: string, shouldIncludeHidden=false, nftFilter: NFT[] = [],
  ): Promise<ProfileSearchNFT[]> {
    const nftIds = nftFilter.length ? nftFilter.map((n) => n.id) : undefined
    const queryRunner = db.getDataSource(true).createQueryRunner()
    return queryRunner.query(`
    SELECT
      nft.*,
      row_to_json(collection.*) AS collection,
      edge.hide AS "isHide"
    FROM
      edge
      JOIN nft ON nft.id = edge."thatEntityId"
      JOIN collection ON collection.contract = nft.contract
    WHERE
      edge."thisEntityType" = 'Profile'
      AND edge."thisEntityId" = $1
      AND edge."thatEntityType" = 'NFT'
      ${nftFilter.length ? 'AND edge."thatEntityId" = ANY($2)' : ''}
      AND edge."edgeType" = 'Displays'
      ${shouldIncludeHidden ? '' : 'AND edge."hide" = false'}
    ORDER BY
      edge.hide ASC,
      edge.weight ASC,
      edge."updatedAt" DESC`, [profileId, nftIds].filter(x => !!x))
  }

}
