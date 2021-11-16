import { entity } from '@src/db'
import { gql } from '@src/defs'
import { PageInfo, PageInput } from '@src/defs/gql'
import { buildInvalid } from '@src/graphql/error/app.error'

export type PaginatedResponse<T> = {
  totalCount: number
  pageInfo: PageInfo
  items: Array<T>
}

export function getSkip(input: PageInput): number {
  if (input.afterCursor && input.first) {
    return Number(input.afterCursor)
  } else if (input.beforeCursor && input.last) {
    return Math.max(0, Number(input.beforeCursor) - input.last)
  } else {
    throw buildInvalid('Invalid pagination input', 'INVALID_CURSORS')
  }
}

export function getTake(input: PageInput): number {
  if (input.afterCursor && input.first) {
    return input.first
  } else if (input.beforeCursor && input.last) {
    return input.last
  } else {
    throw buildInvalid('Invalid pagination input', 'INVALID_CURSORS')
  }
}

type FnPaginatedResult2Promise<T> =
    (result: [Array<T>, number]) => Promise<PaginatedResponse<T>>
/** 
 * @returns a function which will construct a PaginatedResponse
 * from the input [results: Array<T>, count: number] (which is 
 * the expected shape of a findAndCount operation).
 * 
 * pageInput is the pagination parameters used to fetch that data.
 * It should contain *either* afterCursor+first *or* beforeCursor+last
 */
export const paginatedResponse = <T>(pageInput: PageInput): FnPaginatedResult2Promise<T> => {
  return (result: [Array<T>, number]) => (new Promise((resolve) => {
    let firstCursor: string
    let lastCursor: string
    if (pageInput.afterCursor && pageInput.first) {
      firstCursor = pageInput.afterCursor
      lastCursor = String(Number(pageInput.afterCursor) + result[0].length)
    } else if (pageInput.beforeCursor && pageInput.last) {
      firstCursor = String(Math.max(0, Number(pageInput.beforeCursor) - result[0].length))
      lastCursor = pageInput.beforeCursor
    } else {
      throw buildInvalid('Invalid pagination input', 'INVALID_CURSORS')
    }
    resolve({
      items: result[0],
      totalCount: result[1],
      pageInfo: {
        firstCursor: firstCursor,
        lastCursor: lastCursor,
      },
    })
  }))
}

export const toBidsOutput: (response: PaginatedResponse<entity.Bid>) => Promise<gql.BidsOutput>
    = (response: PaginatedResponse<entity.Bid>) => {
      return new Promise((resolve) => resolve({
        bids: response.items,
        totalCount: response.totalCount,
        pageInfo: response.pageInfo,
      }))
    }