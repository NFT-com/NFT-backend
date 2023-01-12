import queue from 'async/queue'
import { Pool as PgClient, QueryResult } from 'pg'
import * as Typesense from 'typesense'
import { CollectionSchema, CollectionUpdateSchema } from 'typesense/lib/Typesense/Collection'
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections'

import { _logger, helper } from '@nftcom/shared'
import { db } from '@nftcom/shared'
import { ActivityType } from '@nftcom/shared/defs'

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
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 50_000
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
const LARGE_COLLECTIONS = [
  '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
  '0x06012c8cf97BEaD5deAe237070F9587f8E7A266d',
  '0xD1E5b0FF1287aA9f9A268759062E4Ab08b9Dacbe',
  '0x495f947276749Ce646f68AC8c248420045cb7b5e',
]

class Commander {

  client: Typesense.Client
  repositories: db.Repository
  pgClient: PgClient

  constructor(client: Typesense.Client, repositories: db.Repository, pgClient: PgClient) {
    this.client = client
    this.repositories = repositories
    this.pgClient = pgClient
  }

  retrieveListings = async (): Promise<any>  => {
    return (await this.repositories.txActivity.findActivitiesNotExpired(ActivityType.Listing))
      .reduce((map, txActivity: TxActivityDAO) => {
        if (helper.isNotEmpty(txActivity.order.protocolData) && txActivity.nftId.length) {
          const nftIdParts = txActivity.nftId[0].split('/')
          const k = `${nftIdParts[1]}-${nftIdParts[2]}`
          if (map[k]?.length) {
            map[k].push(txActivity)
          } else {
            map[k] = [txActivity]
          }
        }
        return map
      }, {})
  }

  reindexNFTsByContract = async (contractAddr: string, listingMap?: any): Promise<void> => {
    const nfts = await this.repositories.nft.findAllWithRelationsByContract(contractAddr)
    const collection = await mapCollectionData('nfts', nfts, this.repositories, listingMap)
    if (collection?.length) {
      await this.client.collections('nfts').documents().delete({ 'filter_by': `contractAddr:=${contractAddr}` })
      try {
        await this.client.collections('nfts').documents().import(collection, { action: 'upsert' })
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

  private _indexNFTs = async (collectionName: string, listingMap: any, mappingQ: any): Promise<string> => {
    const name = 'nfts'
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
    })).filter((c) => !LARGE_COLLECTIONS.includes(c.contract)).map((c) => c.contract)

    const q = queue(async (contract) => {
      let retrievedCount = 0,
        totalCount = 0,
        cursor: string[] = [contract, undefined]
      do {
        logger.info({ contract, name }, 'COLLECTING DATA')
        const [data, count] = await this._retrieveData(name, cursor)
        retrievedCount = data.length
        totalCount = count
        cursor = [data[data.length - 1].contract, data[data.length - 1].id]
        logger.info({ contract, retrievedCount, totalCount, cursor })
        mappingQ.push({ data, q, name, listingMap, collectionName })
      } while (retrievedCount !== totalCount)
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
    await mappingQ.drain()

    return name
  }

  private _indexLargeCollections = async (collectionName: string, listingMap: any, mappingQ: any): Promise<any> => {
    const name = 'nfts'

    const q = queue(async (cursor: string[]) => {
      logger.info({ contract: cursor[0], name }, 'COLLECTING DATA')
      const [data, count] = await this._retrieveData(name, cursor, 500_000)
      const retrievedCount = data.length
      const totalCount = count
      logger.info({ contract: cursor[0], retrievedCount, totalCount, cursor, shouldPause: true })
      mappingQ.push({ data, q, name, listingMap, collectionName })
    }, 2)

    for (const contract of LARGE_COLLECTIONS) {
      const result = await this.pgClient.query(`WITH collection_ids AS 
      (
        SELECT id,
          ROW_NUMBER() OVER (ORDER BY id ASC) as rn
        FROM nft
        WHERE contract = $1
      )
      SELECT id
      FROM collection_ids
      WHERE (rn = 1 OR rn % 500000 = 0)`, [contract])
      q.push(result.rows.map((r) => [contract, r.id]), (err, task) => {
        if (err) {
          logger.error(err)
          return
        }
        logger.info(task)
      })
    }

    await q.drain()
    await mappingQ.drain()
    
    return listingMap
  }

  restore = async (): Promise<void> => {
    const timestamp = new Date().getTime()
    for (const schema of schemas) {
      schema.name = `${schema.name}-${timestamp}`
      await this.client.collections().create(schema as CollectionCreateSchema)
    }

    const nftDocs = []
    const mappingQ = queue(async ({ data, q, name, listingMap, collectionName, shouldPause }) => {
      if (shouldPause && nftDocs.length >= 1_500_000) {
        q.pause()
      }
      logger.info({ contract: data[0]?.contract, name }, 'MAPPING DATA')
      const mappedData = await mapCollectionData(name, data, this.repositories, listingMap)
      const documents = mappedData.filter((x) => x !== undefined)
      if (documents) {
        nftDocs.push(...documents)
        if (q.length() === 0 || nftDocs.length > 50_000) {
          const batch = nftDocs.splice(0)
          await addDocumentsToTypesense(this.client, collectionName, batch)
          logger.info({ contract: new Set(batch.map((d) => d.contractAddr)) }, 'DOCUMENTS added to typesense')
          if (q?.paused && nftDocs.length < 1_500_000) {
            q.resume()
          }
        }
      }
    }, 1)
    const collectionNames = (await Promise.all([
      this._indexCollection(`collections-${timestamp}`),
      this.retrieveListings()
        .then(async (listingMap) => {
          return (await Promise.all([
            this._indexLargeCollections(`nfts-${timestamp}`, listingMap, mappingQ),
            this._indexNFTs(`nfts-${timestamp}`, listingMap, mappingQ),
          ]))[1]
        }),
    ]))

    for (const name of collectionNames) {
      const collectionName = `${name}-${timestamp}`
      await this.client.aliases().upsert(name, { collection_name: collectionName })
    }
  }

  private _dropFields = (fields: string[]): { name: string; drop: boolean }[] => {
    return fields.map(field => {
      return { name: field, drop: true }
    })
  }
  update = async (collection: string, fields: string[]): Promise<void> => {
    for (const schema of schemas) {
      if (schema.name === collection) {
        const updateSchema = {
          fields: [
            ...this._dropFields(fields),
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
