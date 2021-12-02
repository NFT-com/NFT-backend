import * as _ from 'lodash'

import { gql, Pageable } from '@nftcom/gql/defs'
import { appError } from '@nftcom/gql/error'
import { _logger, defs, helper } from '@nftcom/shared'

type PageResolvers<T> = {
  firstAfter: () => Promise<defs.PageableResult<T>>
  firstBefore: () => Promise<defs.PageableResult<T>>
  lastAfter?: () => Promise<defs.PageableResult<T>>
  lastBefore?: () => Promise<defs.PageableResult<T>>
}

type FnResult2Pageable = <T>(result: defs.PageableResult<T>) => Pageable<T>

const logger = _logger.Factory(_logger.Context.PageInput, _logger.Context.GraphQL)

export const hasAfter = (input: gql.PageInput): boolean => helper.isNotEmpty(input.afterCursor)

export const hasBefore = (input: gql.PageInput): boolean => helper.isNotEmpty(input.beforeCursor)

export const hasFirst = (input: gql.PageInput): boolean => helper.isNotEmpty(input.first)

export const hasLast = (input: gql.PageInput): boolean => helper.isNotEmpty(input.last)

export const reverseResult = <T>(result: defs.PageableResult<T>): defs.PageableResult<T> => {
  const [list, total] = result
  const reverseList = _.reverse(list)
  return [reverseList, total]
}

export const resolvePage = <T>(
  pageInput: gql.PageInput,
  pageResolvers: PageResolvers<T>,
): Promise<defs.PageableResult<T>> => {
  logger.debug('resolvePage', { pageInput })
  if (hasAfter(pageInput)) {
    return hasFirst(pageInput)
      ? pageResolvers.firstAfter()
      : pageResolvers.lastAfter()
  }
  return hasFirst(pageInput)
    ? pageResolvers.firstBefore()
    : pageResolvers.lastBefore()
}

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
  cursor = helper.toDateIsoString(),
  numItems = 20,
): gql.PageInput => {
  if (_.isEmpty(input)) {
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

/**
 * Cursor based pagination filter and by default it is sorted based on time desc
 * "before" and "after" in page terms refers to "later" and "earlier" respectively
 *
 *                                cursor
 *               |<-- last n before | first n after -->|
 * 12pm  11am  10am  9am  8am  7am  6am  5am  4am  3am  2am  1am
 */
export const toPageableFilter = <T>(
  pageInput: gql.PageInput,
  filter: Partial<T>,
  cursorKey = 'createdAt',
  isDateCursor = true,
): Partial<T> => {
  let cursorValue = null
  if (isDateCursor) {
    cursorValue = hasAfter(pageInput)
      ? helper.lessThanDate(pageInput.afterCursor)
      : helper.moreThanDate(pageInput.beforeCursor)
  } else {
    cursorValue = hasAfter(pageInput)
      ? helper.lessThan(pageInput.afterCursor)
      : helper.moreThan(pageInput.beforeCursor)
  }
  return { ...filter, deletedAt: null, [cursorKey]: cursorValue }
}

const parseCursorValue = (v: Date | string | number): string => {
  if (_.isDate(v)) {
    return helper.toDateIsoString(v)
  }
  if (_.isNumber(v)) {
    return v.toString()
  }
  return v
}

export const toPageInfo = <T>(
  values: T[],
  pageInput: gql.PageInput,
  cursorValueKey: string,
  cursorValueFn: (v: Date | string | number) => string,
): gql.PageInfo => {
  const numRequested = pageInput.last || pageInput.first
  const firstValue = _.first(values)
  const lastValue = values.length < numRequested ? null : _.last(values)
  return {
    firstCursor: cursorValueFn(firstValue?.[cursorValueKey]),
    lastCursor: cursorValueFn(lastValue?.[cursorValueKey]),
  }
}

/**
 * @param pageInput: gql.PageInput
 * @param cursorKey: string -> cursor key name
 * @param cursorValueFn: (v: Date|string|number): string -> cursor value parsing function
 * @param result: [T[], number]
 *
 * @returns fn: (pageInput) => ([T[], number]) => Pageable<T>
 * Pageable<T>.pageInfo should contain *either* afterCursor+first *or* beforeCursor+last
 */
export const toPageable = (
  pageInput: gql.PageInput,
  cursorKey = 'createdAt',
  cursorValueFn = (v: Date|string|number): string => parseCursorValue(v),
): FnResult2Pageable => {
  return <T>(result: defs.PageableResult<T>): Pageable<T> => {
    const pageInfo = toPageInfo(result[0], pageInput, cursorKey, cursorValueFn)
    return {
      items: result[0],
      totalItems: result[1],
      pageInfo,
    }
  }
}
