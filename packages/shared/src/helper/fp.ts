import { Context, Factory } from './logger'
import { isEmpty, isFalse, isNotEmpty, isTrue } from './misc'

const logger = Factory('fp', Context.Misc)

// T => any
type FnT2Any<T> = (value: T) => any

// T => T
type FnT2T<T> = (value: T) => T

// T[] => T[]
type FnTArray2TArray<T> = (value: T[]) => T[]

// T => K
type FnT2K<T, K> = (value: T) => K

// T => T | Promise<T>
type TOrPromiseT<T> = T | Promise<T>

// T => T | Promise<T>
type FnT2TOrPromiseT<T> = (value: T) => T | Promise<T>

// T => Promise<T>
type FnT2PromiseT<T> = (value: T) => Promise<T>

// T[] => Promise<T>
type FnTArray2PromiseT<T> = (values: T[]) => Promise<T>

// T => Promise<any>
// type FnT2PromiseAny<T> = (value: T) => Promise<unknown>

// T => Promise<U>
export type FnT2PromiseK<T, K> = (value: T) => Promise<K>

// T[] => Promise<K[]>
type FnT2ArrayPromiseKArray<T, K> = (value: T[]) => Promise<K[]>

// T => Boolean
type FnPred<T> = (value: T) => boolean

// T => Boolean
type FnPredPromise<T> = (value: T) => Promise<boolean>

// T => Apply array fn => T
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ArrayFnT2T<T> = (v: T, i: number, a: T[]) => T

// T => Apply array fn => boolean
type ArrayFnT2Boolean<T> = (v: T, i: number, a: T[]) => boolean

export const I = <T>(identity: T): T => identity

export const N = (): null => null

export const negate = <T>(fn: FnPred<T> = Boolean) => {
  return (value: T): boolean => !fn(value)
}

/**
 * runs fn (as a side effect), then returns value
 *
 * @param fn: T => any
 *
 * @return a function: T => T,
 *         that takes a value, calls fn(value), then returns value.
 *         similar to _.tap.
 */
export const tap = <T>(fn: FnT2Any<T>): FnT2Any<T> => {
  return (value: T): T => {
    fn(value)
    return value
  }
}

/**
 * runs fn (as a side effect) and waits for it to complete, then returns value.
 *
 * @param fn: T => Promise<K>
 *
 * @return a function: T => Promise<T>
 *         value => Promise w/ value
 */
export const tapWait = <T, K>(fn: FnT2PromiseK<T, K>): FnT2PromiseT<T> => {
  return (value: T): Promise<T> => fn(value).then(() => value)
}

/**
 * runs tap(thenFn) iff the ifFn predicate returns truthy
 *
 * @param ifFn: T => boolean
 * @param thenFn: T => FnT2TOrPromiseT
 * @param value: T => TOrPromiseT
 *
 * @return fn: (T => Boolean) => (T => TOrPromiseT) => (T => TOrPromiseT)
 */
export const tapIf = <T>(ifFn: FnPred<T>) => {
  return (thenFn: FnT2TOrPromiseT<T>): FnT2TOrPromiseT<T> => {
    return (value: T): TOrPromiseT<T> => ifFn(value) ? tap(thenFn)(value) : value
  }
}

/**
 * runs tap(fn) iff value is not empty
 *
 * @param thenFn: T => FnT2TOrPromiseT
 * @param value: T => TOrPromiseT
 *
 * @return fn: (T => TOrPromiseT) => (T => TOrPromiseT)
 */
export const tapIfNotEmpty = <T>(thenFn: FnT2TOrPromiseT<T>): FnT2TOrPromiseT<T> => {
  return (value: T): TOrPromiseT<T> => isNotEmpty(value) ? tap(thenFn)(value) : value
}

/**
 * runs tap(fn) iff value is empty
 *
 * @param thenFn: T => FnT2TOrPromiseT
 * @param value: T => TOrPromiseT
 *
 * @return fn: (T => TOrPromiseT) => (T => TOrPromiseT)
 */
export const tapIfEmpty = <T>(thenFn: FnT2TOrPromiseT<T>): FnT2TOrPromiseT<T> => {
  return (value: T): TOrPromiseT<T> => isEmpty(value) ? tap(thenFn)(value) : value
}

/**
 * similar to tap but catches and ignores errors produced by fn
 *
 * @param fn: T => any
 *
 * @return a function: T => T
 */
export const tapCatch = <T>(fn: FnT2Any<T>): FnT2T<T> => {
  return (value: T): T => {
    Promise.resolve()
      .then(() => fn(value))
      .catch((err) => logger.error({ value, err }, 'ERROR: tapCatch'))
    return value
  }
}

/**
 * runs fn (as a side effect), then throws the given value.
 *
 * @param fn: T => any
 *
 * @return fn: T => T (technically it always throws an exception)
 */
export const tapThrow = <T>(fn: FnT2Any<T>): FnT2T<T> => {
  return (value: T): T => {
    fn(value)
    throw value
  }
}

/**
 * rejects promise iff ifFn is truthy
 *
 * @param ifFn: T => boolean
 * @param err: Error
 * @param value: T => Promise<T | never>
 *
 * @return fn: (T => boolean) => (err => FnT2PromiseT) => (T => Promise<T | never>)
 */
export const rejectIf = <T>(ifFn: FnPred<T>) => {
  return (err: Error): FnT2PromiseT<T> => {
    return (value: T): Promise<T | never> => {
      return ifFn(value) ? Promise.reject(err) : Promise.resolve(value)
    }
  }
}

/**
 * rejects promise if value is empty
 *
 * @param err: Error
 * @param value: T => Promise<T | never>
 *
 * @return fn: (err => FnT2PromiseT) => (T => Promise<T | never>)
 */
export const rejectIfEmpty = <T>(err: Error): FnT2PromiseT<T> => {
  return (value: T): Promise<T | never> => {
    return isEmpty(value) ? Promise.reject(err) : Promise.resolve(value)
  }
}

/**
 * rejects promise if value is not empty
 *
 * @param err: Error
 * @param value: T => Promise<T | never>
 *
 * @return fn: (err => FnT2PromiseT) => (T => Promise<T | never>)
 */
export const rejectIfNotEmpty = <T>(err: Error): FnT2PromiseT<T> => {
  return (value: T): Promise<T | never> => {
    return isNotEmpty(value) ? Promise.reject(err) : Promise.resolve(value)
  }
}

/**
 * rejects promise if boolean value is false
 *
 * @param err: Error
 * @param value: T => Promise<T | never>
 *
 * @return fn: (err => FnT2PromiseT) => (T => Promise<T | never>)
 */
export const rejectIfFalse = (err: Error): FnT2PromiseT<boolean> => {
  return (value: boolean): Promise<boolean | never> => {
    return isFalse(value) ? Promise.reject(err) : Promise.resolve(value)
  }
}

/**
 * rejects promise if boolean value is true
 *
 * @param err: Error
 * @param value: T => Promise<T | never>
 *
 * @return fn: (err => FnT2PromiseT) => (T => Promise<T | never>)
 */
export const rejectIfTrue = (err: Error): FnT2PromiseT<boolean> => {
  return (value: boolean): Promise<boolean | never> => {
    return isTrue(value) ? Promise.reject(err) : Promise.resolve(value)
  }
}

/**
 * runs tap(then_fn) iff the if_fn predicate returns truthy.
 *
 * otherwise runs tap(else_fn)
 * @param ifFn: T => boolean
 * @param thenFn: T => any
 * @param elseFn: T => any
 *
 * @return fn: (T => Boolean) => (T => any) => (T => any) => (T => T)
 */
export const tapIFElse = <T>(ifFn: FnPred<T>) => {
  return (thenFn: FnT2Any<T>) => {
    return (elseFn: FnT2Any<T>): FnT2T<T> => {
      return (value: T): T => ifFn(value)
        ? tap(thenFn)(value)
        : tap(elseFn)(value)
    }
  }
}

/**
 * similar to thru but catches and ignores errors produced by fn.
 * returns null if the fn throws an error.
 *
 * @param fn: T => U
 *
 * @return T => Promise<U> | Promise<null>
 */
export const thruCatch = <T, U>(fn: FnT2K<T, U>): FnT2PromiseK<T, U | null> => {
  return (value: T): Promise<U | null> => {
    return Promise.resolve()
      .then(() => fn(value))
      .catch((err) => {
        logger.error({ value, err }, 'ERROR: thru_catch')
        return null
      })
  }
}

/**
 * runs fn and throws the value it returns.
 *
 * @param fn: T => K
 *
 * @return fn: T => K (technically it always throws an exception)
 */
export const thruThrow = <T, K>(fn: FnT2K<T, K>): FnT2K<T, K> => {
  return (value: T): K => {
    throw fn(value)
  }
}

/**
 *
 * @param asyncIfFn: T => Promise<Boolean>
 * @param thenFn: T => T | Promise<T>
 *
 * @return fn: (T => Promise<Boolean>) => (T => T | Promise<T>) => (T => Promise<T>)
 */
export const thruAsyncIf = <T>(asyncIfFn: FnPredPromise<T>) => {
  return (thenFn: FnT2T<T> | FnT2PromiseT<T>): FnT2PromiseT<T> => {
    return (value: T): Promise<T> => Promise.resolve(asyncIfFn(value))
      .then((boolValue) => isTrue(boolValue) ? thenFn(value) : value)
  }
}

/**
 * runs thenFn iff ifFn returns truthy
 * otherwise runs elseFn.
 *
 * @param ifFn: T => Boolean
 * @param thenFn: T => K
 * @param elseFn: T => K
 *
 * @return fn: (T => Boolean) => (T => K) => (T => K) => (T => K)
 */
export const thruIfElse = <T, K>(ifFn: FnPred<T>) => {
  return (thenFn: FnT2K<T, K>) => {
    return (elseFn: FnT2K<T, K>): FnT2K<T, K> => {
      return (value: T): K => ifFn(value) ? thenFn(value) : elseFn(value)
    }
  }
}

/**
 * pauses, then returns the value
 * @param ms: milliseconds
 *
 * @return fn: T => Promise<T>
 */
export const pause = <T>(ms: number): FnT2PromiseT<T> => {
  return (value: T): Promise<T> => {
    return new Promise(resolve => setTimeout(() => resolve(value), ms))
  }
}

/**
 * @example fp.thruIf(value => value.checkSomething)(value => { ...do this if true... })
 *
 * runs thenFn iff ifFn returns truthy
 *
 * @param ifFn: T => Boolean
 * @param thenFn: FnT2Any
 *
 * @return fn: (T => Boolean) => (T => FnT2Any) => (T => any)
 */
export const thruIf = <T>(ifFn: FnPred<T>) => {
  return (thenFn: FnT2Any<T>): FnT2Any<T> => {
    return (value: T) => ifFn(value) ? thenFn(value) : value
  }
}

/**
 * @example fp.thruIfEmpty(value => isEmpty)(value => { ...do this if true... })
 *
 * runs thenFn when value is empty (e.g., null, undefined etc)
 *
 * @param thenFn: FnT2Any
 * @param value: T => any
 *
 * @return fn: (T => FnT2Any) => (T => any)
 */
export const thruIfEmpty = <T>(thenFn: FnT2Any<T>): FnT2Any<T> => {
  return (value: T) => isEmpty(value) ? thenFn(value) : value
}

/**
 * @example fp.thruIfNotEmpty(value => isNotEmpty)(value => { ...do this if true... })
 *
 * runs thenFn when value is not empty (e.g., null, undefined etc)
 *
 * @param thenFn: T => FnT2Any
 * @param value: T => any
 *
 * @return fn: (T => FnT2Any) => (T => any)
 */
export const thruIfNotEmpty = <T>(thenFn: FnT2Any<T>): FnT2Any<T> => {
  return (value: T) => isNotEmpty(value) ? thenFn(value) : value
}

/**
 * @example fp.thruIfTrue(value => isNotEmpty)(value => { ...do this if true... })
 *
 * runs thenFn when value is true
 *
 * @param thenFn: T => FnT2Any
 * @param value: T => any
 *
 * @return fn: (T => FnT2Any) => (T => any)
 */
export const thruIfTrue = (thenFn: FnT2Any<boolean>): FnT2Any<boolean> => {
  return (value: boolean) => isTrue(value) ? thenFn(value) : value
}

/**
 * @example fp.thruIfFalse(value => isFalse)(value => { ...do this if true... })
 *
 * runs thenFn when value is false
 *
 * @param thenFn: T => FnT2Any
 * @param value: T => any
 *
 * @return fn: (T => FnT2Any) => (T => any)
 */
export const thruIfFalse = (thenFn: FnT2Any<boolean>): FnT2Any<boolean> => {
  return (value: boolean) => isFalse(value) ? thenFn(value) : value
}

/**
 * @example fp.thruIfOther(otherValue => otherValue.checkSomething)(value => { ...do this if true... })
 *
 * runs thenFn iff ifFn returns truthy
 *
 * @param otherValue: K
 * @param ifFn: otherValue => Boolean
 * @param thenFn: T => FnT2Any
 * @param value: T => any
 *
 * @return fn: (otherValue => Boolean) => (T => FnT2Any) => (T => any)
 */
export const thruIfOther = <K>(ifFn: FnPred<K>) => {
  return (otherValue: K) => {
    return <T>(thenFn: FnT2Any<T>): FnT2Any<T> => {
      return (value: T) => ifFn(otherValue) ? thenFn(value) : value
    }
  }
}

/**
 * @example fp.thruIfOther(otherValue => isEmpty)(value => { ...do this if true... })
 *
 * runs thenFn iff other value is empty
 *
 * @param otherValue: K
 * @param thenFn: T => FnT2Any
 * @param value: T => any
 *
 * @return fn: (otherValue => Boolean) => (T => FnT2Any) => (T => any)
 */
export const thruIfOtherEmpty = <K>(otherValue: K) => {
  return <T>(thenFn: FnT2Any<T>): FnT2Any<T> => {
    return (value: T) => isEmpty(otherValue) ? thenFn(value) : value
  }
}

/**
 * @example fp.thruIfOther(otherValue => isNotEmpty)(value => { ...do this if true... })
 *
 * runs thenFn if other value is not empty
 *
 * @param otherValue: K
 * @param thenFn: T => FnT2Any
 * @param value: T => any
 *
 * @return fn: (T => FnT2Any) => (T => any)
 */
export const thruIfOtherNotEmpty = <K>(otherValue: K) => {
  return <T>(thenFn: FnT2Any<T>): FnT2Any<T> => {
    return (value: T) => isNotEmpty(otherValue) ? thenFn(value) : value
  }
}

/**
 * Async/Promise Wrapper utility that returns an array with either an error (`arr[0]`) or
 * the promise result (`arr[1]`). (Provides cleaner error handling for async code.)
 *
 * @param {Promise<T>} promise - the promise to wrap
 * @returns {Promise<[U, undefined] | [null, T]>} - a promise that will resolve to the result of
 * the original promise, or an error object if the original promise fails.
 *
 * @example
 * const [exampleErr, exampleResult] = await fp.promiseTo(promiseFn(), {extraErrDetails: 'Error Detail'});
 */
export function promiseTo<T, U = Error>(promise: Promise<T>): Promise<[U, undefined] | [null, T]> {
  return promise
    .then<[null, T]>((data: T) => [null, data])
    .catch<[U, undefined]>((err: U) => [err, undefined],
  )
}

/**
 * @example fp.promiseFilter(fn => fn that returns Promise<K>)(Array of T)
 *
 * @param mapper: (v: T, i: number, a: T[]) => Promise<K>
 * @param list: T[]
 *
 * @return fn: (T[] => Promise<K[]>
 */
export const promiseMap = <T, K>(
  mapper: (v: T, i: number, a: T[]) => Promise<K>,
): FnT2ArrayPromiseKArray<T, K> => {
  return (list: T[]): Promise<K[]> => Promise.all(list.map(mapper))
}

/**
 * @example fp.promiseFilter(fn => fn that returns Promise<boolean>)(Array of T)
 *
 * @param filter: (v: T, i: number, a: T[]) => Promise<boolean>
 * @param negate: boolean
 * @param list: T[]
 *
 * @return fn: (T[] => Promise<T[]>)
 */
export const promiseFilter = <T>(negate: boolean) => {
  return (
    filter: (v: T, i: number, a: T[]) => Promise<boolean>,
  ): FnT2ArrayPromiseKArray<T, T> => {
    return (list: T[]): Promise<T[]> => {
      return Promise.resolve(list)
        .then(promiseMap(filter))
        .then(filterMap => list.filter((_, index) => negate ? !filterMap[index] : filterMap[index]))
    }
  }
}

/**
 * @example fp.thruThrowIf(ifFn => fn that returns boolean)(fn => fn that returns Error)
 *
 * @param ifFn: T => Boolean
 * @param fn: T => new Error()
 */
export const thruThrowIf = <T>(ifFn: FnPred<T>) => {
  return (fn: () => InstanceType<typeof Error>): FnT2T<T> => {
    return (value: T): T => {
      if (ifFn(value)) {
        throw fn()
      }
      return value
    }
  }
}

/**
 * @example fp.seqAsync(fn => fn that returns Promise<T>)(Array of T)
 *
 * @param fn: T => Promise<T>
 * @param values: T[]
 */
export const seqAsync = <T>(fn: FnT2PromiseT<T>): FnTArray2PromiseT<T> => {
  return (values: T[]): Promise<T> => {
    return values.reduce((prev: Promise<any>, value): Promise<T> => {
      return prev.then(() => fn(value))
    }, Promise.resolve())
  }
}

/**
 * @example fp.filterIf(otherValue => otherValue.checkSomething)(value => filter list by thenFn)
 *
 * filters list by thenFn iff ifFn returns truthy
 *
 * @param ifFn: otherValue => Boolean
 * @param otherValue: K
 * @param filterFn: T[] => T[]
 * @param values: T[] => T[]
 *
 * @return fn: (otherValue => Boolean) => (ArrayFnT2Boolean => T[]) => (T[] => T[])
 */
export const filterIf = <K>(ifFn: FnPred<K>) => {
  return (otherValue: K) => {
    return <T>(filterFn: ArrayFnT2Boolean<T>): FnTArray2TArray<T> => {
      return (values: T[]) => ifFn(otherValue) ? values.filter(filterFn) : values
    }
  }
}

/**
 * @example fp.filterIf(otherValue => isEmpty)(value => filter list by thenFn)
 *
 * filters list by thenFn iff otherValue is empty
 *
 * @param otherValue: K
 * @param filterFn: T[] => T[]
 * @param values: T[] => T[]
 *
 * @return fn: (ArrayFnT2Boolean => T[]) => (T[] => T[])
 */
export const filterIfEmpty = <K>(otherValue: K) => {
  return <T>(filterFn: ArrayFnT2Boolean<T>): FnTArray2TArray<T> => {
    return (values: T[]) => isEmpty(otherValue) ? values.filter(filterFn) : values
  }
}

/**
 * @example fp.filterIf(otherValue => isEmpty)(value => filter list by thenFn)
 *
 * filters list by thenFn iff otherValue is not empty
 *
 * @param otherValue: K
 * @param filterFn: T[] => T[]
 * @param values: T[] => T[]
 *
 * @return fn: (ArrayFnT2Boolean => T[]) => (T[] => T[])
 */
export const filterIfNotEmpty = <K>(otherValue: K) => {
  return <T>(filterFn: ArrayFnT2Boolean<T>): FnTArray2TArray<T> => {
    return (values: T[]) => isNotEmpty(otherValue) ? values.filter(filterFn) : values
  }
}
