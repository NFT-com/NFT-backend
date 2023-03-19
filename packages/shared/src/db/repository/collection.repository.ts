import { FindOneOptions, FindOptionsSelect } from 'typeorm'

import { _logger } from '@nftcom/shared'
import { db } from '@nftcom/shared/db'
import { Collection } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export type Logger = ReturnType<typeof _logger.Factory>

export class CollectionRepository extends BaseRepository<Collection> {

  constructor(public logger: Logger) {
    super(Collection)
  }

  /**
   * Finds a collection by its contract address.
   * @param {string} address - the contract address
   * @param {string} chainId - the chain id of the collection
   * @param {true} [isOfficial=true] - whether the collection is official
   * @returns {Promise<Collection>} - the collection
   */
  public findByContractAddress = (address: string, chainId: string, isOfficial?: true): Promise<Collection> => {
    const whereQuery = { contract: address, deletedAt: null, chainId }
    this.logger.warn({ isOfficial, address, chainId })

    return this.findOne({ where: isOfficial ? { isOfficial: true, ...whereQuery } : whereQuery })
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

  /**
   * Find all official collections.
   * @param {Record<keyof Collection, boolean>} [select] - The fields to select.
   * @returns A promise that resolves to an array of collections.
   */
  findAllOfficial<T extends FindOptionsSelect<Collection>>(select?: T): T extends Pick<FindOneOptions<Collection>, 'select'> ? Promise<Pick<FindOneOptions<Collection>, 'select'>[]> : Promise<Collection[]> {
    return this.getRepository(true).find({
      where: {
        isOfficial: true,
      },
      select: (select as FindOptionsSelect<any>),
    })
  }

}
