import { entity } from '@src/db'
import { gql } from '@src/defs'
import { PageInfo, PageInput } from '@src/defs/gql'
import { buildInvalid } from '@src/graphql/error/app.error'

export type PaginatedResponse<T> = {
  totalItems: number
  pageInfo: PageInfo
  items: T[]
}

export function hasFirst(input: PageInput): boolean {
  return input.afterCursor != null && input.first != null
}
export function hasLast(input: PageInput): boolean {
  return input.beforeCursor != null && input.last != null
}

export function validateCursors(input: PageInput): void {
  if ((!hasFirst(input) && !hasLast(input)) || (hasFirst(input) && hasLast(input))) {
    throw buildInvalid('Invalid pagination input', 'INVALID_CURSORS')
  }
}

export function getSkip(input: PageInput): number {
  validateCursors(input)
  return hasFirst(input)
    ? Number(input.afterCursor)
    : Math.max(0, Number(input.beforeCursor) - input.last)
}

export function getTake(input: PageInput): number {
  validateCursors(input)
  return hasFirst(input) ? input.first : input.last
}

type FnPaginatedResult2Response<T> =
    (result: [T[], number]) => PaginatedResponse<T>

/** 
 * @returns a function which will construct a PaginatedResponse
 * from the input [results: T[], count: number] (which is 
 * the expected shape of a findAndCount operation).
 * 
 * pageInput is the pagination parameters used to fetch that data.
 * It should contain *either* afterCursor+first *or* beforeCursor+last
 */
export function paginatedResponse<T>(pageInput: PageInput): FnPaginatedResult2Response<T> {
  return (result: [T[], number]) => {
    validateCursors(pageInput)
    const firstCursor = hasFirst(pageInput)
      ? pageInput.afterCursor
      : String(Math.max(0, Number(pageInput.beforeCursor) - result[0].length))
    const lastCursor = hasFirst(pageInput)
      ? String(Number(pageInput.afterCursor) + result[0].length)
      : pageInput.beforeCursor
    return {
      items: result[0],
      totalItems: result[1],
      pageInfo: {
        firstCursor: firstCursor,
        lastCursor: lastCursor,
      },
    }
  }
}

export const toBidsOutput: (response: PaginatedResponse<entity.Bid>) => Promise<gql.BidsOutput>
    = (response: PaginatedResponse<entity.Bid>) => {
      return new Promise((resolve) => resolve({
        bids: response.items,
        totalItems: response.totalItems,
        pageInfo: response.pageInfo,
      }))
    }
