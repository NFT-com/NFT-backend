import { queue } from 'async'
import { Pool as PgClient, QueryResult } from 'pg'
import QueryStream from 'pg-query-stream'
import { Transform, Writable } from 'stream'
import * as Typesense from 'typesense'
import { CollectionSchema, CollectionUpdateSchema } from 'typesense/lib/Typesense/Collection'
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections'

import { searchEngineService, txActivityService } from '@nftcom/gql/service'
import { _logger, defs, utils } from '@nftcom/shared'
import { db } from '@nftcom/shared'

import { mapCollectionData } from './collections'
import { TxActivityDAO } from './model'
import collections from './schemas/collections.json'
import nfts from './schemas/nfts.json'

const logger = _logger.Factory(
  _logger.Context.General,
  _logger.Context.Typesense,
)

const NFT_PAGE_SIZE = parseInt(process.env.NFT_PAGE_SIZE) || 100_000
const N_CHUNKS = parseInt(process.env.N_CHUNKS) || 1
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 10_000
const chunk = (arr: any[], size: number): any[] => {
  const chunks = []
  while (arr.length) {
    chunks.push(arr.splice(0, size))
  }
  return chunks
}
const addDocumentsToTypesense = async (
  client: any,
  collectionName: string,
  documents: any[],
): Promise<void> => {
  while (documents.length) {
    const batch = documents.splice(0, BATCH_SIZE)
    try {
      const responses = await Promise.all(
        chunk(batch, Math.ceil(batch.length / N_CHUNKS)).map(docChunk => {
          const jsonl = docChunk.map((doc: any) => JSON.stringify(doc)).join('\n')
          logger.info({ size: docChunk.length }, 'IMPORTING BATCH')
          return client
            .collections(collectionName)
            .documents()
            .import(jsonl)
            .catch(async (err) => {
              if (err.httpStatus === 413) {
                const responses = await Promise.all(
                  chunk(docChunk, Math.ceil(docChunk.length / 2)).map(async (dc) => {
                    const jsonl = dc.map((doc: any) => JSON.stringify(doc)).join('\n')
                    logger.info({ size: dc.length }, 'IMPORTING BATCH')
                    return await client.collections(collectionName).documents().import(jsonl)
                  }),
                )
                return responses.flat()
              } else {
                throw err
              }
            })
        }),
      )

      const failedImports = responses.map(data =>
        data
          .split('\n')
          .map((r: string) => JSON.parse(r))
          .filter((item: { success: boolean }) => item.success === false),
      ).flat()

      if (failedImports.length) {
        throw new Error(`Error indexing items ${JSON.stringify(failedImports, null, 2)}`)
      }
    } catch (err) {
      logger.error(err, 'Error importing jsonl documents')
    }
  }
}

const schemas = [collections, nfts]

class Commander {

  client: Typesense.Client
  repositories: db.Repository
  pgClient: PgClient
  seService = searchEngineService.SearchEngineService()

  constructor(client: Typesense.Client, repositories: db.Repository, pgClient: PgClient) {
    this.client = client
    this.repositories = repositories
    this.pgClient = pgClient
  }

  retrieveListings = async (opts?: { nftContract?: string; sinceUpdatedAt?: Date }): Promise<any>  => {
    const { nftContract, sinceUpdatedAt } = opts || {}
    return txActivityService.listingMapFrom(await this.repositories.txActivity
      .findActivitiesNotExpired(
        defs.ActivityType.Listing, { nftContract, updatedAt: sinceUpdatedAt }) as TxActivityDAO[])
  }

  reindexNFTsByContract = async (contractAddr: string, listingMap?: any): Promise<void> => {
    const nfts = await this.repositories.nft.findAllWithRelationsByContract(contractAddr)
    const collection = await mapCollectionData('nfts', nfts, this.repositories, listingMap)
    if (collection?.length) {
      await this.client.collections('nfts').documents().delete({ 'filter_by': `contractAddr:=${contractAddr}` })
      try {
        await addDocumentsToTypesense(this.client, 'nfts', collection)
      } catch (e) {
        logger.error('unable to import collection:', e)
      }
    }
  }

  erase = async (): Promise<PromiseSettledResult<CollectionSchema|void>[]> => {
    const [collections, aliasesResponse] = await Promise.all([
      this.client.collections().retrieve(),
      this.client.aliases().retrieve(),
    ])
    const aliases = aliasesResponse.aliases.map(ar => ar.collection_name)
    return Promise.allSettled(
      collections.map((collection) => {
        if (!aliases.includes(collection.name)) {
          return this.client.collections(collection.name).delete()
        }
        return Promise.resolve()
      }),
    )
  }

  private _findPageWithCollectionAndWallet(
    cursorContract: string,
    cursorId: string,
    limit: number,
    isSingleContract?: boolean): Promise<QueryResult<any>> {
    const cursorAndLimit = `
    AND (nft.contract, nft.id) > ($1, $2)
    ORDER BY nft.contract ASC, nft.id ASC LIMIT $3`
    const limitOnly = `ORDER BY nft.contract ASC, nft.id ASC LIMIT ${isSingleContract ? '$2' : '$1'}`
    return this.pgClient.query(`
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

  private _retrieveData = async (name: string, cursor?: string | string[], pageSize = NFT_PAGE_SIZE):
  Promise<[any[], number]> => {
    if (name === 'nfts') {
      const cursorContract = cursor ? cursor[0] : undefined
      const cursorId = cursor ? cursor[1] : undefined
      const data = (await this._findPageWithCollectionAndWallet(cursorContract, cursorId, pageSize, true)).rows
      const count = parseInt(data[0].total_count)
      return [data, count]
    } else if (name === 'collections') {
      const data = await this.repositories.collection.findPageWithAnNft(cursor as string)
      return [data, parseInt(data[0].total_count)]
    }
    const data = await this.repositories[name.slice(0, -1)].findAll()
    return [data, data.length]
  }

  private _indexCollection = async (collectionName: string): Promise<string> => {
    const name = 'collections'
    let retrievedCount = 0,
      totalCount = 0,
      cursor: string
    do {
      logger.info({ name }, 'COLLECTING DATA')
      const [data, count] = await this._retrieveData(name, cursor)
      retrievedCount = data.length
      totalCount = count
      cursor = data[data.length - 1].contract

      logger.info({ retrievedCount, totalCount, cursor })
      logger.info({ name }, 'MAPPING DATA')
      const documents = (
        await mapCollectionData(name, data, this.repositories)
      ).filter(x => x !== undefined)

      if (documents) {
        await addDocumentsToTypesense(this.client, collectionName, documents)
      }
    } while (retrievedCount !== totalCount)
    return name
  }

  private _indexNFTCollection = async (collectionName: string, contract: string, listingMap: any): Promise<string> => {
    const name = 'nfts'
    const repositories = this.repositories
    const mapNFTs = new Transform({
      readableObjectMode: true,
      writableObjectMode: true,
      async transform(chunk, _encoding, callback) {
        const mappedData = (await mapCollectionData(name, [chunk], repositories, listingMap))
          .filter((x) => x !== undefined)
        callback(null, mappedData)
      },
    })
    const nftDocs = []
    const q = queue(async ({ docs }: { docs: any[] }) => {
      await addDocumentsToTypesense(this.client, collectionName, docs)
      logger.info('DOCUMENTS added to typesense')
    }, 1)
    const indexNFTs = new Writable({
      objectMode: true,
      async write(chunk, _encoding, callback) {
        nftDocs.push(...chunk)
        if (nftDocs.length >= BATCH_SIZE) {
          const batch = nftDocs.splice(0)
          q.push({ docs: batch })
        }
        callback()
      },
    })
    await new Promise((resolve, reject) => {
      this.pgClient.connect((err, client, done) => {
        if (err) throw err
        const query = new QueryStream(
          `SELECT
            nft.*,
            row_to_json(collection.*) as collection,
            row_to_json(wallet.*) as wallet
          FROM
            nft
            LEFT JOIN collection
              ON collection."contract" = nft."contract"
              AND collection."isSpam" = false
            LEFT JOIN wallet ON wallet."id" = nft."walletId"
            WHERE nft."deletedAt" IS NULL
            AND nft."contract" = $1`,
          [contract],
          { batchSize: 500_000, highWaterMark: 500_000 },
        )
        const stream = client.query(query)
        stream.on('end', async () => {
          q.push({ docs: nftDocs })
          done()
          resolve(undefined)
        })
        stream.on('error', () => {
          reject()
        })
        stream
          .pipe(mapNFTs)
          .pipe(indexNFTs)
      })
    })

    await q.drain()

    return name
  }

  private _indexNFTs = async (collectionName: string, listingMap: any): Promise<string> => {
    const collections = (await this.repositories.collection.find({
      select: { contract: true },
      where: {
        isSpam: false,
      },
      order: {
        totalSales: {
          direction: 'DESC',
          nulls: 'LAST',
        },
      },
    })).filter((c) => !defs.LARGE_COLLECTIONS.includes(c.contract)).map((c) => c.contract)

    const q = queue(async (contract: string) => {
      await this._indexNFTCollection(collectionName, contract, listingMap)
      return { contract, remaining: q.length() }
    }, 40)

    q.push(collections, (err, task) => {
      if (err) {
        logger.error(err)
        return
      }
      logger.info(task)
    })

    await q.drain()

    return 'nfts'
  }

  private _indexLargeCollections = async (collectionName: string, listingMap: any): Promise<string> => {
    const q = queue(async (contract: string) => {
      await this._indexNFTCollection(collectionName, contract, listingMap)
      return { contract, remaining: q.length() }
    }, defs.LARGE_COLLECTIONS.length)

    q.push(defs.LARGE_COLLECTIONS, (err, task) => {
      if (err) {
        logger.error(err)
        return
      }
      logger.info(task)
    })

    await q.drain()

    return 'nfts'
  }

  restore = async (): Promise<void> => {
    const timestamp = new Date().getTime()
    for (const schema of schemas) {
      schema.name = `${schema.name}-${timestamp}`
      await this.client.collections().create(schema as CollectionCreateSchema)
    }

    const collectionNames = await Promise.all([
      this._indexCollection(`collections-${timestamp}`),
      this.retrieveListings()
        .then(async (listingMap) => {
          await this._indexLargeCollections(`nfts-${timestamp}`, listingMap)
          return listingMap
        })
        .then(async (listingMap) => {
          return await this._indexNFTs(`nfts-${timestamp}`, listingMap)
        }),
    ])

    logger.info('***** DONE INDEXING COLLECTIONS *****')

    for (const name of collectionNames) {
      const collectionName = `${name}-${timestamp}`
      await this.client.aliases().upsert(name, { collection_name: collectionName })
    }

    const listings = []
    const listingMap = await this.retrieveListings({ sinceUpdatedAt: new Date(timestamp) })
    for (const key in listingMap) {
      listings.push(...listingMap[key])
    }
    const nftsWithListingUpdates = await utils.getNFTsFromTxActivities(listings)
    await this.seService.indexNFTs(nftsWithListingUpdates)
  }

  private _dropFields = (fields: string[], newFields: string[]): { name: string; drop: boolean }[] => {
    return fields.filter((field) => !newFields.includes(field)).map(field => {
      return { name: field, drop: true }
    })
  }
  update = async (collection: string, fields: string[], newFields: string[]): Promise<void> => {
    for (const schema of schemas) {
      if (schema.name === collection) {
        const updateSchema = {
          fields: [
            ...this._dropFields(fields, newFields),
            ...schema.fields.filter(field => fields.includes(field.name)),
          ],
        }
        const alias = await this.client.aliases(schema.name).retrieve()
        await this.client.collections(alias.collection_name).update(updateSchema as CollectionUpdateSchema)
      }
    }
  }

  help = async (): Promise<void> => {
    console.log('Uncomment the commands you want to run!')
  }

}

export default Commander
