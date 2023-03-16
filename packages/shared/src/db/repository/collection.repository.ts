import { gql } from '@nftcom/gql/defs'
import { db } from '@nftcom/shared/db'
import { Collection } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class CollectionRepository extends BaseRepository<Collection> {

  constructor() {
    super(Collection)
  }

  public findByContractAddress = (address: string, chainId: string): Promise<Collection> => {
    return this.findOne({
      where: { contract: address, deletedAt: null, chainId },
    })
  }

  findPageWithAnNft(cursor?: string, limit?: number): Promise<any[]> {
    const queryRunner = db.getDataSource(true).createQueryRunner()
    const cursorAndLimit = `
    AND contract > $1
    ORDER BY contract ASC LIMIT $2`
    const limitOnly = 'ORDER BY contract ASC LIMIT $1'
    return queryRunner.query(`
    WITH nft_collections AS (
      SELECT DISTINCT ON (contract) * FROM nft
    )
    SELECT
      collection.*,
      row_to_json(nft_collections.*) as nft,
      COUNT(*) OVER () AS total_count
    FROM collection
    LEFT JOIN nft_collections ON nft_collections."contract" = collection."contract"
    AND collection."deletedAt" IS NULL
      ${cursor ? cursorAndLimit : limit ? limitOnly : ''}`, [cursor, limit].filter(x => !!x))
  }

  findAllOfficial(): Promise<Collection[]> {
    return this.getRepository(true).find({
      where: {
        isOfficial: true,
      },
    })
  }

  findOfficialCollections(): Promise<Required<Pick<gql.Collection, 'id' | 'chainId' | 'contract' | 'name'>>[]> {
    return this.getRepository(true).find(
      {
        select: {
          id: true,
          chainId: true,
          contract: true,
          name: true,
        },
        where: {
          isOfficial: true,
        },

      })
  }

}
