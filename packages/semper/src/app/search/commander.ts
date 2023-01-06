import queue from 'async/queue'
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

  constructor(client: Typesense.Client, repositories: db.Repository) {
    this.client = client
    this.repositories = repositories
  }

  retrieveListings = async (): Promise<any>  => {
    return (await this.repositories.txActivity.findActivitiesNotExpired(ActivityType.Listing))
      .reduce((map, txActivity: TxActivityDAO) => {
        if (helper.isNotEmpty(txActivity.order.protocolData)) {
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

  private _retrieveData = async (name: string, cursor?: string | string[]):
  Promise<[any[], number]> => {
    if (name === 'nfts') {
      const cursorContract = cursor ? cursor[0] : undefined
      const cursorId = cursor ? cursor[1] : undefined
      logger.info({ cursorContract, cursorId }, 'NFT QUERY')
      const data = await this.repositories
        .nft.findPageWithCollectionAndWallet(cursorContract, cursorId, NFT_PAGE_SIZE, true)
      logger.info({ cursorContract, cursorId }, 'FINISHED NFT QUERY')
      const count = parseInt(data[0].total_count)
      return [data, count]
    } else if (name === 'collections') {
      const data = await this.repositories.collection.findPageWithAnNft(cursor as string)
      return [data, parseInt(data[0].total_count)]
    }
    const data = await this.repositories[name.slice(0, -1)].findAll()
    return [data, data.length]
  }

  _indexCollection = async (collectionName: string): Promise<string> => {
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

  _indexNFTs = async (collectionName: string): Promise<string> => {
    const name = 'nfts'
    const listingMap = await this.retrieveListings()
    const collections = (await this.repositories.collection.find({
      select: { contract: true },
      where: {
        isSpam: false,
      },
    })).map((c) => c.contract)

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
        logger.info({ contract, name }, 'MAPPING DATA')
        const mappedData = await mapCollectionData(name, data, this.repositories, listingMap)
        const documents = mappedData.filter((x) => x !== undefined)
        if (documents) {
          await addDocumentsToTypesense(this.client, collectionName, documents)
          logger.info({ contract }, 'DOCUMENTS added to typesense')
        }
      } while (retrievedCount !== totalCount)
      return { contract, remaining: q.length() }
    }, 10)

    q.push(collections, (err, task) => {
      if (err) {
        logger.error(err)
        return
      }
      logger.info(task)
    })

    await q.drain()

    return name
  }

  restore = async (): Promise<void> => {
    const timestamp = new Date().getTime()
    for (const schema of schemas) {
      schema.name = `${schema.name}-${timestamp}`
      await this.client.collections().create(schema as CollectionCreateSchema)
    }

    const collectionNames = await Promise.all([
      this._indexCollection(`collections-${timestamp}`),
      this._indexNFTs(`nfts-${timestamp}`),
    ])

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
