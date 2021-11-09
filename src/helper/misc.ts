import * as _ from 'lodash'
import { FindOperator, In } from 'typeorm'

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

export const parseBoolean = (str: string): boolean => {
  return _.isString(str)
    ? str === 'true' || str === '1'
    : !!str
}

export const isTrue = (v: boolean): boolean => v === true

export const isFalse = (v: boolean): boolean => v === false

export const isNotEmpty = <T>(v: T): boolean => !_.isEmpty(v)

export const safeIn = <T>(arr: T[]): FindOperator<T> =>
  _.isEmpty(arr) ? In([null]) : In(arr)

export const safeInForOmitBy = <T>(arr: T[]): FindOperator<T> | null =>
  _.isEmpty(arr) ? null : In(arr)

export const safeObject = <T>(obj: T): T =>
  _.isEmpty(obj) ? <T>{} : obj

export const removeEmpty = <T>(obj: _.Dictionary<T>): _.Dictionary<T> =>
  _.omitBy<T>(obj, _.isEmpty)
