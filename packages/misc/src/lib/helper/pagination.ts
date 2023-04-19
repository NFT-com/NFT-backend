import * as _ from 'lodash'
import { IsNull } from 'typeorm'

import { appError } from '@nftcom/error-types'
import { _logger, defs, helper } from '@nftcom/shared'

import { OffsetPageable, Pageable, ToOffsetPageableArgs } from '../defs'

/*
 * Copied from generated gql.ts in
 * Would be nice to have a way to import but not depend on gql
 */
type Maybe<T> = T | null
type InputMaybe<T> = Maybe<T>
type Scalars = {
  ID: string
  String: string
  Boolean: boolean
  Int: number
  Float: number
  Address: any
  Bytes: any
  Date: any
  DateTime: any
  Uint256: any
  Upload: any
};
export type PageInput = {
  afterCursor?: InputMaybe<Scalars['String']>
  beforeCursor?: InputMaybe<Scalars['String']>
  first?: InputMaybe<Scalars['Int']>
  last?: InputMaybe<Scalars['Int']>
};
export type PageInfo = {
  firstCursor?: Maybe<Scalars['String']>
  lastCursor?: Maybe<Scalars['String']>
}
export type OffsetPageInput = {
  page?: InputMaybe<Scalars['Int']>
  pageSize?: InputMaybe<Scalars['Int']>
}
/*
 * End copy from generated gql.ts
 * Would be nice to have a way to import but not depend on gql
 */


type PageResolvers<T> = {
  firstAfter: () => Promise<defs.PageableResult<T>>
  firstBefore: () => Promise<defs.PageableResult<T>>
  lastAfter?: () => Promise<defs.PageableResult<T>>
  lastBefore?: () => Promise<defs.PageableResult<T>>
}

type DefaultCursor = {
  afterCursor?: string
  beforeCursor?: string
}

type FnResult2Pageable = <T>(result: defs.PageableResult<T>) => Pageable<T>

const logger = _logger.Factory(_logger.Context.PageInput, _logger.Context.GraphQL)

export const hasAfter = (input: PageInput): boolean => helper.isNotEmpty(input.afterCursor)

export const hasBefore = (input: PageInput): boolean => helper.isNotEmpty(input.beforeCursor)

export const hasFirst = (input: PageInput): boolean => helper.isNotEmpty(input.first)

export const hasLast = (input: PageInput): boolean => helper.isNotEmpty(input.last)

export const reverseResult = <T>(result: defs.PageableResult<T>): defs.PageableResult<T> => {
  const [list, total] = result
  const reverseList = _.reverse(list)
  return [reverseList, total]
}

export const resolvePage = <T>(
  pageInput: PageInput,
  pageResolvers: PageResolvers<T>,
): Promise<defs.PageableResult<T>> => {
  logger.debug({ pageInput }, 'resolvePage')
  if (hasAfter(pageInput)) {
    return hasFirst(pageInput) ? pageResolvers.firstAfter() : pageResolvers.lastAfter()
  }
  return hasFirst(pageInput) ? pageResolvers.firstBefore() : pageResolvers.lastBefore()
}

const isOrderByDate = (orderKey: string): boolean =>
  ['createdAt', 'updatedAt', 'deletedAt', 'offerAcceptedAt'].includes(orderKey)

export const getDefaultCursor = (orderBy: string): DefaultCursor => {
  return isOrderByDate(orderBy) ? { afterCursor: helper.toDateIsoString() } : { beforeCursor: '0' }
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
 */
export const safeInput = (input: PageInput, cursor: DefaultCursor, defaultNumItems = 20): PageInput => {
  if (helper.isEmpty(input)) {
    return {
      first: defaultNumItems,
      ...cursor,
    }
  }

  const newInput = helper.removeEmpty(input)

  if (hasFirst(newInput) && hasLast(newInput)) {
    throw appError.buildInvalid('Invalid pagination input', 'INVALID_FIRST_LAST')
  }

  if (hasAfter(newInput) && hasBefore(newInput)) {
    throw appError.buildInvalid('Invalid pagination input', 'INVALID_AFTER_BEFORE')
  }

  if (helper.isFalse(hasFirst(input)) && helper.isFalse(hasLast(input))) {
    return { ...newInput, first: defaultNumItems }
  }

  if (helper.isFalse(hasAfter(input)) && helper.isFalse(hasBefore(input))) {
    return { ...newInput, ...cursor }
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
export const toPageableFilters = <T>(
  pageInput: PageInput,
  filters: Partial<T>[],
  orderKey = 'createdAt',
  cursor: (orderBy: string) => DefaultCursor = getDefaultCursor,
): Partial<T>[] => {
  const safePageInput = safeInput(pageInput, cursor(orderKey))
  let cursorValue = null
  if (isOrderByDate(orderKey)) {
    cursorValue = hasAfter(safePageInput)
      ? helper.lessThanDate(safePageInput.afterCursor)
      : helper.moreThanDate(safePageInput.beforeCursor)
  } else {
    cursorValue = hasAfter(safePageInput)
      ? helper.lessThan(safePageInput.afterCursor)
      : helper.moreThan(safePageInput.beforeCursor)
  }
  return filters.map(filter => ({ ...filter, deletedAt: IsNull(), [orderKey]: cursorValue }))
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
  result: defs.PageableResult<T>,
  pageInput: PageInput,
  orderKey: string,
  cursorValueFn: (v: Date | string | number) => string,
  firstVal?: any,
  lastVal?: any,
): PageInfo => {
  const [values, total] = result
  const numRequested = pageInput.last || pageInput.first
  const firstValue = firstVal ?? _.first(values)
  const lastValue = lastVal ?? (total <= numRequested ? null : _.last(values))
  return {
    firstCursor: cursorValueFn(firstValue?.[orderKey]),
    lastCursor: cursorValueFn(lastValue?.[orderKey]),
  }
}

/**
 * Takes in an OffsetPageInput and a PageableResult and returns the offset result with page count.
 * @param {OffsetPageInput} offsetPageInput - the OffsetPageInput object
 * @param {defs.PageableResult<T>} result - the PageableResult object
 * @returns {defs.PageableResult<T>} - the new PageableResult object
 */
export const toOffsetPageable = <T>({ offsetPageInput, result }: ToOffsetPageableArgs<T>): OffsetPageable<T> => {
  const fallbackPageSize = 5000
  return {
    items: result[0],
    totalItems: result[1],
    pageCount: Math.ceil(result[1] / (offsetPageInput.pageSize || fallbackPageSize)),
  }
}

/**
 * @param pageInput: PageInput
 * @param firstValue: pre-defined first value
 * @param lastValue: pre-defined last value
 * @param orderKey: string -> cursor key name
 * @param cursorValueFn: (v: Date|string|number): string -> cursor value parsing function
 * @param result: [T[], number]
 *
 * @returns fn: (pageInput) => ([T[], number]) => Pageable<T>
 * Pageable<T>.pageInfo should contain *either* afterCursor+first *or* beforeCursor+last
 */
export const toPageable = (
  pageInput: PageInput,
  firstValue?: any,
  lastValue?: any,
  orderKey = 'createdAt',
  cursorValueFn = (v: Date | string | number): string => parseCursorValue(v),
): FnResult2Pageable => {
  return <T>(result: defs.PageableResult<T>): Pageable<T> => {
    const pageInfo = toPageInfo(result, pageInput, orderKey, cursorValueFn, firstValue, lastValue)
    return {
      items: result[0],
      totalItems: result[1],
      pageInfo,
    }
  }
}
