import { Client } from 'typesense'
import { ImportResponse } from 'typesense/lib/Typesense/Documents'

import { _logger } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.Typesense)
const TYPESENSE_HOST = process.env.TYPESENSE_HOST
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY

const typesenseClient: Client = new Client({
  nodes: [
    {
      host: TYPESENSE_HOST,
      port: 443,
      protocol: 'https',
    },
  ],
  apiKey: TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
})

export type NullClient = Record<string, unknown> // Null object passed in for testing
export class SearchEngineClient {
  private _client: Client | Partial<Client>

  static create(): SearchEngineClient {
    return new SearchEngineClient(typesenseClient)
  }

  static createNull(client: NullClient): SearchEngineClient {
    return new SearchEngineClient(client)
  }

  constructor(client: Client | NullClient) {
    this._client = client
  }

  private isFullySuccessful = (response: ImportResponse[]): boolean | PromiseLike<boolean> => {
    if (!Array.isArray(response)) return false
    const unsuccessful = response.filter(r => !r.success)
    if (unsuccessful.length) {
      logger.error(unsuccessful, 'Typesense import failed')
    }
    return !unsuccessful.length
  }

  insertDocuments = async (collection: string, documents: any[]): Promise<boolean> => {
    if (!documents.length) return true
    let response
    try {
      response = await this._client.collections(collection).documents().import(documents, { action: 'upsert' })
    } catch (e) {
      logger.error({ documents }, 'Error in document importing to Typesense')
      logger.error(e, 'Error importing to Typesense')
    }
    return this.isFullySuccessful(response)
  }

  removeDocument = async (collection: string, documentId: string): Promise<boolean> => {
    try {
      const response = (await this._client.collections(collection).documents(documentId).delete()) as { id: string }
      return !!response.id
    } catch (e) {
      logger.error(e, 'Error deleting from Typesense')
    }
    return false
  }
}
