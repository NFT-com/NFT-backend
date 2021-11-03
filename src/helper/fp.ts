import * as _ from 'lodash'

import { helper } from '@src/helper'

// TODO improve functions documentation

// T => any
type FnT2Any<T> = (value: T) => any

// T => T
type FnT2T<T> = (value: T) => T

// T => K
type FnT2K<T, K> = (value: T) => K

// T => Promise<T>
type FnT2PromiseT<T> = (value: T) => Promise<T>

// T[] => Promise<T>
type FnTArray2PromiseT<T> = (values: T[]) => Promise<T>

// T => Promise<any>
// type FnT2PromiseAny<T> = (value: T) => Promise<unknown>

// T => Promise<U>
type FnT2PromiseK<T, K> = (value: T) => Promise<K>

// T[] => Promise<K[]>
type FnT2ArrayPromiseKArray<T, K> = (value: T[]) => Promise<K[]>

// T => Boolean
type FnPred<T> = (value: T) => boolean

// T => Boolean
type FnPredPromise<T> = (value: T) => Promise<boolean>

/**
 * runs fn (as a side effect), then returns value
 *
 * @param fn: T => any
 * @return a function: T => T,
 *         that takes a value, calls fn(value), then returns value.
 *         similar to _.tap.
 */
export const tap = <T>(fn: FnT2Any<T>): FnT2T<T> => (value: T): T => {
  fn(value)
  return value
}

/**
 * runs tap(thenFn) iff the ifFn predicate returns truthy
 *
 * @param ifFn: T => boolean
 * @param thenFn: T => any
 * @return fn: (T => Boolean) => (T => any) => (T => T)
 */
export const tapIf = <T>(ifFn: FnPred<T>) => (thenFn: FnT2Any<T>): FnT2T<T> => {
  return (value: T): T => ifFn(value) ? tap(thenFn)(value) : value
}

/**
 * runs fn (as a side effect) and waits for it to complete, then returns value.
 * @param fn: T => Promise<K>
 * @return a function: T => Promise<T>
 *         value => Promise w/ value
 */
export const tapWait =
  <T, K>(fn: FnT2PromiseK<T, K>): FnT2PromiseT<T> =>
    (value: T): Promise<T> => {
      return fn(value).then(() => value)
      // return Promise.resolve(fn(value))
      //   .then(() => value)
    }

/**
 * similar to tap but catches and ignores errors produced by fn
 *
 * @param fn: T => any
 * @return a function: T => T
 */
export const tapCatch = <T>(fn: FnT2Any<T>): FnT2T<T> => (value: T): T => {
  Promise.resolve()
    .then(() => fn(value))
    .catch((err) => console.error('ERROR: tapCatch:', { value, err }))
  return value
}

/**
 * runs tap(fn) iff value is not empty
 * @param fn: T => any
 * @return fn: T => T | null
 */
export const tapMaybe = <T>(fn: FnT2Any<T>): FnT2T<T> => (value: T): T => {
  return helper.isNotEmpty(value) ? tap(fn)(value) : value
}

/**
 * runs fn (as a side effect), then throws the given value.
 * @param fn: T => any
 * @return fn: T => T (technically it always throws an exception)
 */
export const tapThrow = <T>(fn: FnT2Any<T>): FnT2T<T> => (value: T): T => {
  fn(value)
  throw value
}

/**
 * rejects promise iff ifFn is truthy
 * @param ifFn: T => boolean
 * @param err
 * @return Promise<T> | Promise<never>
 */
export const tapRejectIf =
  <T>(ifFn: FnPred<T>, err: Error) =>
    (value: T): Promise<T | never> => {
      return ifFn(value) ? Promise.reject(err) : Promise.resolve(value)
    }

/**
 * rejects promise if value is nil
 * @param err
 * @return Promise<T> | Promise<never>
 */
export const tapRejectIfEmpty = <T>(err: Error) => (value: T): Promise<T | never> => {
  return tapRejectIf<T>(_.isEmpty, err)(value)
}

/**
 * rejects promise if boolean value is false
 * @param err
 * @return Promise<T> | Promise<never>
 */
export const tapRejectIfFalse = (err: Error) => (value: boolean): Promise<boolean | never> => {
  return tapRejectIf<boolean>(helper.isFalse, err)(value)
}

/**
 * rejects promise if boolean value is true
 * @param err
 * @return Promise<T> | Promise<never>
 */
export const tapRejectIfTrue = (err: Error) => (value: boolean): Promise<boolean | never> => {
  return tapRejectIf<boolean>(helper.isTrue, err)(value)
}

/**
 * runs tap(then_fn) iff the if_fn predicate returns truthy.
 * otherwise runs tap(else_fn)
 * @param ifFn: T => boolean
 * @param thenFn: T => any
 * @param elseFn: T => any
 * @return fn: (T => Boolean) => (T => any) => (T => any) => (T => T)
 */
export const tapIFElse =
  <T>(ifFn: FnPred<T>) =>
    (thenFn: FnT2Any<T>) =>
      (elseFn: FnT2Any<T>): FnT2T<T> => {
        return (value: T): T => ifFn(value)
          ? tap(thenFn)(value)
          : tap(elseFn)(value)
      }

/**
 * similar to thru but catches and ingores errors produced by fn.
 * returns null if the fn throws an error.
 * @param fn: T => U
 * @return T => Promise<U> | Promise<null>
 */
export const thruCatch =
  <T, U>(fn: FnT2K<T, U>): FnT2PromiseK<T, U | null> =>
    (value: T): Promise<U | null> => {
      return Promise.resolve()
        .then(() => fn(value))
        .catch((err) => {
          console.error('ERROR: thru_catch:', { value, err })
          return null
        })
    }

/**
 * runs fn and throws the value it returns.
 * @param fn: T => K
 * @return fn: T => K (technically it always throws an exception)
 */
export const thruThrow = <T, K>(fn: FnT2K<T, K>): FnT2K<T, K> => (value: T): K => {
  throw fn(value)
}

/**
 *
 * @param asyncIfFn: T => Promise<Boolean>
 * @param thenFn: T => T | Promise<T>
 * @return fn: (T => Promise<Boolean>) => (T => T | Promise<T>) => (T => Promise<T>)
 */
export const thruAsyncIf =
  <T>(asyncIfFn: FnPredPromise<T>) =>
    (thenFn: FnT2T<T> | FnT2PromiseT<T>): FnT2PromiseT<T> => {
      return (value: T): Promise<T> => Promise.resolve(asyncIfFn(value))
        .then((boolValue) => helper.isTrue(boolValue) ? thenFn(value) : value)
    }

/**
 * runs thenFn iff ifFn returns truthy
 * otherwise runs elseFn.
 * @param ifFn: T => Boolean
 * @param thenFn: T => K
 * @param elseFn: T => K
 * @return fn: (T => Boolean) => (T => K) => (T => K) => (T => K)
 */
export const thruIfElse =
  <T, K>(ifFn: FnPred<T>) =>
    (thenFn: FnT2K<T, K>) =>
      (elseFn: FnT2K<T, K>): FnT2K<T, K> => {
        return (value: T): K => ifFn(value) ? thenFn(value) : elseFn(value)
      }

/**
 * pauses, then returns the value
 * @param ms: milliseconds
 * @return fn: T => Promise<T>
 */
export const pause = <T>(ms: number): FnT2PromiseT<T> => (value: T): Promise<T> => {
  return new Promise(resolve => setTimeout(() => resolve(value), ms))
}

/**
 * @example fp.thruIf(value => value.checkSomething)(value => { ...do this if true... })
 *
 * runs thenFn iff ifFn returns truthy
 * @param ifFn: T => Boolean
 * @param thenFn: T => T
 *
 * @return fn: (T => Boolean) => (T => T) => (T => T)
 */
export const thruIf = <T>(ifFn: FnPred<T>) => (thenFn: FnT2T<T>): FnT2T<T> => {
  return (value: T): T => ifFn(value) ? thenFn(value) : value
}

/**
 * @example fp.thruIfEmpty(value => value.isEmpty)(value => { ...do this if true... })
 *
 * runs thenFn when value is empty (e.g., null, undefined etc)
 * @param thenFn: T => T
 *
 * @return fn: (T => Boolean) => (T => Promise<T>) => (T => Promise<T>)
 */
export const thruIfEmpty = <T>(thenFn: FnT2PromiseT<T>): FnT2PromiseT<T> => {
  return (value: T): Promise<T> => _.isEmpty(value) ? thenFn(value) : Promise.resolve(value)
}

/**
 * @example fp.promiseFilter(fn => fn that returns Promise<K>)(Array of T)
 *
 * @param mapper: (v: T, i: number, a: T[]) => Promise<K>
 * @param list: T[]
 */
export const promiseMap =
  <T, K>(
    mapper: (v: T, i: number, a: T[]) => Promise<K>,
  ): FnT2ArrayPromiseKArray<T, K> =>
    (list: T[]): Promise<K[]> => {
      return Promise.all(list.map(mapper))
    }

/**
 * @example fp.promiseFilter(fn => fn that returns Promise<boolean>)(Array of T)
 *
 * @param filter: (v: T, i: number, a: T[]) => Promise<boolean>
 * @param negate: boolean
 * @param list: T[]
 */
export const promiseFilter =
  <T>(
    filter: (v: T, i: number, a: T[]) => Promise<boolean>,
    negate: boolean,
  ): FnT2ArrayPromiseKArray<T, T> =>
    (list: T[]): Promise<T[]> => {
      return Promise.resolve(list)
        .then(promiseMap(filter))
        .then(filterMap => list.filter((_, index) => negate ? !filterMap[index] : filterMap[index]))
    }

export const I = <T>(identity: T): T => identity
export const N = (): null => null

export const negate = <T>(fn: FnPred<T> = Boolean) => (value: T): boolean => !fn(value)

/**
 * @example fp.thruThrowIf(ifFn => fn that returns boolean)(fn => fn that returns Error)
 *
 * @param ifFn: T => Boolean
 * @param fn: T => new Error()
 */
export const thruThrowIf =
  <T>(ifFn: FnPred<T>) =>
    (fn: () => InstanceType<typeof Error>): FnT2T<T> => {
      return (value: T): T => {
        if (ifFn(value)) {
          throw fn()
        }
        return value
      }
    }

/**
 * @example fp.seqAsync(fn => fn that returns Promise<T>)(Array of T)
 *
 * @param fn: T => Promise<T>
 * @param values: T[]
 */
export const seqAsync =
  <T>(fn: FnT2PromiseT<T>): FnTArray2PromiseT<T> =>
    (values: T[]): Promise<T> => {
      return values.reduce((prev: Promise<any>, value): Promise<T> => {
        return prev.then(() => fn(value))
      }, Promise.resolve())
    }

