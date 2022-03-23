// TYPESENSE COLLECTION SCHEMA CREATION 
// below job only needs to run on startup. creates collection schema if not already created 
// schema should always exist in production, so may drop in future or keep for ref

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Job } from 'bull'
import Typesense from 'typesense'

import { _logger } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
const TYPESENSE_HOST = process.env.TYPESENSE_HOST
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY

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
    'port': 443,      // For Typesense Cloud use 443
    'protocol': 'https',   // For Typesense Cloud use https
  }],
  'apiKey': TYPESENSE_API_KEY,
  'connectionTimeoutSeconds': 2,
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const typesenseCollectionSchemas = async (job: Job): Promise<any> => {
  // check if collection exist, if not create collection schema
   
  const stringType = 'string' as CollectionFieldType
  //const numType = 'int32' as FieldType
  
  // NFT SCHEMA 
  const nftFields = []
  nftFields.push({ name: 'id', type: stringType, facet: false, index: false })
  nftFields.push({ name: 'contract', type: stringType, facet: false, index: true })
  nftFields.push({ name: 'tokenId', type: stringType, facet: false, index: true })
  nftFields.push({ name: 'name', type: stringType, facet: false, index: true })
  nftFields.push({ name: 'type', type: stringType, facet: false, index: true })
    
  const nftCollectionFields = nftFields as CollectionFieldSchema[]
    
  const nftSchema = {
    name: 'nfts',
    fields: nftCollectionFields,
  }
  const nftCollectionSchema = nftSchema as CollectionCreateSchema
    
  // need to add logic to not create after first init 
  client.collections().create(nftCollectionSchema)
    .then(() => logger.debug('nft index schema created'))
    .catch(() => logger.info('nft index schema already created, skipping...'))

  // COLLECTIONS SCHEMA (coll)
  const collFields = []
  collFields.push({ name: 'id', type: stringType, facet: false, index: false })
  collFields.push({ name: 'contract', type: stringType, facet: false, index: true })
  collFields.push({ name: 'name', type: stringType, facet: false, index: true })
    
  const collCollectionFields = collFields as CollectionFieldSchema[]
    
  const collSchema = {
    name: 'collections',
    fields: collCollectionFields,
  }
  const collCollectionSchema = collSchema as CollectionCreateSchema
    
  client.collections().create(collCollectionSchema)
    .then(() => logger.debug('collections index schema created'))
    .catch(() => logger.info('collection index schema already created, skipping...'))
}