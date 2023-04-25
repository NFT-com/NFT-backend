import { searchEngineClient } from '@nftcom/service'

export class NullTypesenseClient implements searchEngineClient.NullClient {
  private _importResponse: any[]

  constructor(importResponse: any[]) {
    this._importResponse = importResponse
  }

  [x: string]: unknown // make the compiler happy

  collections = (_: string): any => {
    return {
      documents: () => {
        return {
          import: (_: any[]) => {
            return this._importResponse
          },
          delete: () => {
            return { id: 'true' }
          },
        }
      },
    }
  }
}
