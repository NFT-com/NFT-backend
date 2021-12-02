import { isEmpty } from 'lodash'

import { gql, Pageable } from '@nftcom/gql/defs'
import { appError } from '@nftcom/gql/error'
import { helper } from '@nftcom/shared'

export const hasAfter = (input: gql.PageInput): boolean => helper.isNotEmpty(input.afterCursor)

export const hasBefore = (input: gql.PageInput): boolean => helper.isNotEmpty(input.beforeCursor)

export const hasFirst = (input: gql.PageInput): boolean => helper.isNotEmpty(input.first)

export const hasLast = (input: gql.PageInput): boolean => helper.isNotEmpty(input.last)

export const DEFAULT_CURSOR_VALUE = new Date('2021-01-01').toISOString()

/**
 * Returns a safe page input by validating the given page input
 *
 * When input is empty, return a default one with `first` and `afterCursor`
 * When input.first & input.last are empty, return input with default first
 * When input.after & input.before are empty, return input with default after
 *
 * @param input
 * @param cursor
 * @param numItems
 */
export const safeInput = (
  input: gql.PageInput,
  cursor = DEFAULT_CURSOR_VALUE,
  numItems = 20,
): gql.PageInput => {
  if (isEmpty(input)) {
    return {
      first: numItems,
      afterCursor: cursor,
    }
  }
  const newInput = helper.removeEmpty(input)

  if (hasFirst(newInput) && hasLast(newInput)) {
    throw appError.buildInvalid('Invalid pagination input', 'INVALID_FIRST_LAST')
  }

  if (hasAfter(newInput) && hasBefore(newInput)) {
    throw appError.buildInvalid('Invalid pagination input', 'INVALID_AFTER_BEFORE')
  }

  if (helper.isFalse(hasFirst(input)) && helper.isFalse(hasBefore(input))) {
    return { ...newInput, first: numItems }
  }

  if (helper.isFalse(hasAfter(input)) && helper.isFalse(hasBefore(input))) {
    return { ...newInput, afterCursor: cursor }
  }

  return newInput
}

type FnResult2Pageable = <T>(result: [T[], number]) => Pageable<T>

/**
 * @param pageInput: gql.PageInput
 * @param result: [T[], number]
 *
 * @returns fn: (pageInput) => ([T[], number]) => Pageable<T>
 * Pageable<T>.pageInfo should contain *either* afterCursor+first *or* beforeCursor+last
 */
export const toPageable = (pageInput: gql.PageInput): FnResult2Pageable => {
  return <T>(result: [T[], number]): Pageable<T> => {
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
