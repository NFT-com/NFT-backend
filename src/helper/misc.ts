import * as _ from 'lodash'
import { skip } from 'graphql-resolvers'

import { Context } from '@src/db'
import { appError, userError } from '@src/graphql/error'

export const stringListToMap = (
  str: string,
  listSep = '|',
  kvSep = ':',
): Map<string, string> => {
  const list = str.split(listSep)
  return list.reduce((agg: Map<string, string>, val: string) => {
    const kv = val.split(kvSep)
    agg.set(kv[0], kv[1])
    return agg
  }, new Map<string, string>())
}

export const toCompositeKey = (val1: string, val2: string): string => `${val1}:${val2}`

export const hasChainId = (_: any, args: any, ctx: Context): any => {
  const { chainId } = ctx
  return chainId ? skip : appError.buildMissingChainIdError()
}

export const isAuthenticated = (_: any, args: any, ctx: Context): any => {
  const { address } = ctx
  return address ? skip : userError.buildAuthError()
}

export const parseBoolean = (str: string): boolean => {
  return _.isString(str)
    ? str === 'true' || str === '1'
    : !!str
}
