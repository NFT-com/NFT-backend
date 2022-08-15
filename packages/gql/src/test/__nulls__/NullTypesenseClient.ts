import { NullClient } from '@nftcom/gql/adapter/searchEngineClient'

export class NullTypesenseClient implements NullClient {

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