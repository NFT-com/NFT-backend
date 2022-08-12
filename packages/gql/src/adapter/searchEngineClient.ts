import { Client } from 'typesense'
import { ImportResponse } from 'typesense/lib/Typesense/Documents'

import { _logger } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.Typesense)
const TYPESENSE_HOST = process.env.TYPESENSE_HOST
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY

const typesenseClient: Client = new Client({
  'nodes': [{
    'host': TYPESENSE_HOST,
    'port': 443,
    'protocol': 'https',
  }],
  'apiKey': TYPESENSE_API_KEY,
  'connectionTimeoutSeconds': 10,
})

class NullClient {

  private _importResponse: any[]

  constructor(importResponse: any[]) {
    this._importResponse = importResponse
  }

  collections = (_: string): any => {
    return {
      documents: () => {
        return {
          import: (_: any[]) => {
            return this._importResponse
          },
        }
      },
    }
  }

}

export class SearchEngineClient {

  private _client: any

  static create(): SearchEngineClient {
    return new SearchEngineClient(typesenseClient)
  }

  static createNull(importResponse: any[]): SearchEngineClient {
    return new SearchEngineClient(new NullClient(importResponse))
  }

  constructor(client: Client | NullClient) {
    this._client = client
  }

  private isFullySuccessful = (response: ImportResponse[]): boolean | PromiseLike<boolean> => {
    const unsuccessful = response.filter(r => !r.success)
    if (unsuccessful.length) {
      logger.error('Typesense import failed', unsuccessful)
    }
    return !unsuccessful.length
  }

  insertDocuments = async (collection: string,  documents: any[]): Promise<boolean> => {
    const response = await this._client.collections(collection).documents().import(documents)
    return this.isFullySuccessful(response)
  }

}