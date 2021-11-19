import { BigNumber } from 'ethers'
import * as _ from 'lodash'

type FnPred<T> = (value: T) => boolean
type FnTArray2TArray<T> = (value: T[]) => T[]
type ArrayFnT2Boolean<T> = (v: T, i: number, a: T[]) => boolean
// type FnT2T<T> = (value: T) => T
// type FnT2PromiseT<T> = (value: T) => Promise<T>
type FnT2TOrPromiseT<T> = (value: T) => T | Promise<T>
type TOrPromiseT<T> = T | Promise<T>
const notEmpty = (v): boolean => !_.isEmpty(v)

const thruIf = <T>(ifFn: FnPred<T>) => {
  return (thenFn: FnT2TOrPromiseT<T>): FnT2TOrPromiseT<T> => {
    return (value: T): TOrPromiseT<T> => ifFn(value) ? thenFn(value) : Promise.resolve(value)
  }
}

const thruIfEmpty = thruIf(_.isEmpty)

const thruIfNotEmpty = thruIf(notEmpty)

const filterIf = <K>(ifFn: FnPred<K>) => {
  return (otherValue: K) => {
    return <T>(filterFn: ArrayFnT2Boolean<T>): FnTArray2TArray<T> => {
      return (values: T[]) => ifFn(otherValue) ? values.filter(filterFn) : values
    }
  }
}

const filterIfNotEmpty = filterIf(notEmpty)

// const startOfTodayUTC = (): Date => new Date(new Date().setUTCHours(0, 0, 0, 0))
// const endOfTodayUTC = (): Date => new Date(new Date().setUTCHours(23, 59, 59, 999))
// const getUTCDate = (date = new Date()): Date => {
//   return new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000)
// }

const main = (): Promise<void> => {
  const list: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const filterFn = (n: number): boolean => n % 2 === 0
  const rv = 'random value'
  const newList = filterIfNotEmpty(rv)(filterFn)(list)
  console.log(newList)

  const fnp1 = (): Promise<string> => Promise.resolve('greeting from fnp1')
  const fnp2 = (): Promise<string> => Promise.resolve('greeting from fnp2')
  const fnp3 = (): string => 'greeting from fnp3'

  let amountHex = BigNumber.from(10)._hex
  console.log(amountHex)
  amountHex = BigNumber.from(20)._hex
  console.log(amountHex)
  const number1 = Number(amountHex)
  console.log(number1)
  // const number2 = BigNumber.from(amountHex).div(BigNumber.from(10).pow(18))
  // console.log(BigNumber.from(0x43d11ccfeafdac0000).toNumber())
  const number2 = number1 / 1E18
  console.log(number2)
  const price = Number('0x153d61df693a6e780000')
  console.log(price, price / 1E18)
  const exp = BigNumber.from('10').pow(18)
  const supply = BigNumber.from('50').mul(exp)
  console.log(Number(supply))

  return Promise.resolve(rv)
    .then(thruIfNotEmpty(fnp3))
    .then(thruIfNotEmpty(fnp1))
    .then(() => '')
    .then(thruIfEmpty(fnp2))
    .then(console.log)
}

main()
  .catch(console.error)
