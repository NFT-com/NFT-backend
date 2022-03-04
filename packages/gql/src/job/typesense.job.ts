// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Job } from 'bull'
import * as Lodash from 'lodash'
import Typesense from 'typesense'

import { _logger, db } from '@nftcom/shared'

const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
const TYPESENSE_HOST = '3.87.139.177' //process.env.TYPESENSE_APP_ID
const TYPESENSE_API_KEY = 'TiwsolWyPwgfGmOvhw9yavpVuWz1YnM4fxHh65BH8JFr6oV4' // process.env.TYPESENSE_API_KEY

//declare type? 
type CollectionFieldType = 'string' | 'int32' | 'int64' | 'float' | 'bool' | 'geopoint' | 'geopoint[]' | 'string[]' | 'int32[]' | 'int64[]' | 'float[]' | 'bool[]' | 'auto' | 'string*'

interface CollectionFieldSchema {
  name: string
  type: CollectionFieldType
  optional?: boolean
  facet?: boolean
  index?: boolean
}

interface CollectionCreateSchema {
  name: string
  default_sorting_field?: string
  fields: CollectionFieldSchema[]
  symbols_to_index?: string[]
  token_separators?: string[]
}

const client = new Typesense.Client({
  'nodes': [{
    'host': TYPESENSE_HOST, // For Typesense Cloud use xxx.a1.typesense.net
    'port': 8108,      // For Typesense Cloud use 443
    'protocol': 'http',   // For Typesense Cloud use https
  }],
  'apiKey': TYPESENSE_API_KEY,
  'connectionTimeoutSeconds': 2,
})

export const typesenseIndexNFTs = async (job: Job): Promise<any> => {
  // check if collection exist, if not create collection schema
   
  const stringType = 'string' as CollectionFieldType
  //const numType = 'int32' as FieldType
    
  const fields = []
  fields.push({ name: 'id', type: stringType, facet: false, index: false })
  fields.push({ name: 'contract', type: stringType, facet: false, index: true })
  fields.push({ name: 'tokenId', type: stringType, facet: false, index: true })
  fields.push({ name: 'name', type: stringType, facet: false, index: true })
  fields.push({ name: 'type', type: stringType, facet: false, index: true })
    
  const collectionFields = fields as CollectionFieldSchema[]
    
  const schema = {
    name: 'nfts',
    fields: collectionFields,
  }
  const collectionSchema = schema as CollectionCreateSchema
    
  // need to add logic to not create after first init 
  client.collections().create(collectionSchema)
    .then(() => logger.debug(job + ' :collection schema created'))
    .catch(err => logger.info('oof, collection schema error: ' + err ))
    
  // limit pull, flatten nfts and push to typesense index
  const dbNfts = await repositories.nft.find({
    select: ['id', 'contract', 'type', 'tokenId', 'metadata'],
  })
  const indexNfts = []
  for (const i in dbNfts) {
    indexNfts.push({
      id: dbNfts[i].id,
      contract: dbNfts[i].contract,
      type: dbNfts[i].type,
      name: dbNfts[i].metadata.name,
      tokenId: dbNfts[i].tokenId,
    })
  }

  const chunks = Lodash.chunk(indexNfts, 100)
  chunks.forEach(chunk => client.collections('nfts').documents().import(chunk, { action: 'create' })
    .then(() => logger.debug('nfts created in typesense'))
    .catch(err => { logger.info('error - could not save nfts in typesense: ' + err)}),
  )
}

export const typesenseIndexCollections = async (job: Job): Promise<any> => {
  // check if collection exist, if not create collection schema
  
  const stringType = 'string' as CollectionFieldType
  //const numType = 'int32' as FieldType
    
  const fields = []
  fields.push({ name: 'id', type: stringType, facet: false, index: true })
  fields.push({ name: 'contract', type: stringType, facet: false, index: true })
  fields.push({ name: 'name', type: stringType, facet: false, index: true })
    
  const collectionFields = fields as CollectionFieldSchema[]
    
  const schema = {
    name: 'collections',
    fields: collectionFields,
  }
  const collectionSchema = schema as CollectionCreateSchema
    
  // need to add logic to not create after first init 
  client.collections().create(collectionSchema)
    .then(() => logger.debug(job + ' :collections collection schema created'))
    .catch(err => logger.info('oof, collection schema error: ' + err ))
    
  // limit pull, flatten nfts and push to typesense index
  const dbCollections = await repositories.collection.find({
    select: ['id', 'contract', 'name'],
  })
  const indexCollections = []
  for (const i in dbCollections) {
    indexCollections.push({
      id: dbCollections[i].id,
      contract: dbCollections[i].contract,
      name: dbCollections[i].name,
    })
  }

  const chunks = Lodash.chunk(indexCollections, 100)
  chunks.forEach(chunk => client.collections('collections').documents().import(chunk, { action: 'create' })
    .then(() => logger.debug('collections created in typesense'))
    .catch(err => { logger.info('error - could not save collections in typesense: ' + err)}),
  )
}

export const typesenseIndexProfiles = async (job: Job): Promise<any> => {
  // check if collection exist, if not create collection schema

  const stringType = 'string' as CollectionFieldType
  //const numType = 'int32' as FieldType
    
  const fields = []
  fields.push({ name: 'id', type: stringType, facet: false, index: true })
  fields.push({ name: 'url', type: stringType, facet: false, index: true })
  fields.push({ name: 'status', type: stringType, facet: false, index: true })
    
  const collectionFields = fields as CollectionFieldSchema[]
    
  const schema = {
    name: 'profiles',
    fields: collectionFields,
  }
  const collectionSchema = schema as CollectionCreateSchema
    
  // need to add logic to not create after first init 
  client.collections().create(collectionSchema)
    .then(() => logger.debug(job + ' :profile schema created'))
    .catch(err => logger.info('oof, collection schema error: ' + err ))
    
  // limit pull, flatten nfts and push to typesense index
  const dbProfiles = await repositories.profile.find({
    select: ['id', 'url', 'status'],
  })
  const indexProfiles = []
  for (const i in dbProfiles) {
    indexProfiles.push({
      id: dbProfiles[i].id,
      url: dbProfiles[i].url,
      status: dbProfiles[i].status,
    })
  }

  const chunks = Lodash.chunk(indexProfiles, 100)
  chunks.forEach(chunk => client.collections('profiles').documents().import(chunk, { action: 'create' })
    .then(() => logger.debug('profiles created in typesense'))
    .catch(err => { logger.info('error - could not save profiles in typesense: ' + err)}),
  )
}