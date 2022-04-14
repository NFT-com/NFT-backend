import { BigNumber, constants, Signature, utils } from 'ethers'
import * as _ from 'lodash'
import { FindOperator, In, LessThan, MoreThan } from 'typeorm'

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

export function getGenesisKeyWhitelist(): Array<string> {
  return [
    '0x59495589849423692778a8c5aaCA62CA80f875a4',
    '0xFC4BCb93a151F68773dA76D5D61E5f1Eea9FD494',
    '0xF968EC896Ffcb78411328F9EcfAbB9FcCFe4E863',
    '0x5c09f8b380140E40A4ADc744F9B199a9383553F9',
    '0x090Be0f933d005EB7f30BEcF78A37B9C0DBb7442',
    '0xa18376780EB719bA2d2abb02D1c6e4B8689329e0',
    '0xD8D46690Db9534eb3873aCf5792B8a12631D8229',
    '0x56a065dFEB4616f89aD733003914A8e11dB6CEdD',
    '0xE65eC5f5583053FADcAF2ebA354F8592D3c2ABb9',
    '0xc97F36837e25C150a22A9a5FBDd2445366F11245',
    '0xcb606fbaE8f03ecA4F394c9c7111B48F1d0f901D',
    '0xC478BEc40f863DE406f4B87490011944aFB9Aa27',
    '0x2b9EE94612b9e038909471600e11993D5624eC42',
    '0x9f76C103788c520dCb6fAd09ABd274440b8D026D',
    '0x338eFdd45AE7D010da108f39d293565449C52682',
    '0x74bB476C99d2fad476DB75654e58404Db6EC4977',
    '0xf9142440D22CE022b5d88062a0b0dce0149e5F65',
    '0xfA3ccA6a31E30Bf9A0133a679d33357bb282c995',
    '0x575A84Bea2588a5207B83C8C9AB5441d9152A57D',
    '0x7F04084166e1F2478B8f7a99FafBA4238c7dDA83',
    '0x60d18B30f1eE234fC07E30e4c34fcb231AD0F0FD',
    '0xA7216b9c5A847bD74A5036962a30A082eDe798C5',
    '0x7fBAf96057687756a0BBa795C38D430CdB704fc6',
    '0x84EEFFB8Ed6958878Eb4a35aB33346D8aF1A01f3',
    '0x34c0774DA64e53cAfC3C17710dFD55f6D2B51c7E',
    '0xBb6113fb407DD8156a2dc1eE7246b86cA0b510ed',
    '0x31EeE8EbAF0eD960537BB272071fE81CAcdDd77A',
    '0x5b4245dC95831B0a10868aC09559b92cF36C8d8D',
    '0x78C5Fa233Eb07486333B91aCA0A6CFa198B24459',
    '0xf7BA53e8D1a6cFcA763D52D5759E17C2139b1b76',
    '0xb6E804A3F8dD47bE8ADBa7d620831B723D611f49',
    '0xd116eA36C50dB0385ABE33d4Cf8F65e0Af5073f7',
    '0xa40b0F5E06b5a33244EC5F1E84235CF39E2B2c8c',
    '0x78908a90A5e8AB9Fd0DbcA58E7aDE532Cf2c8667',
    '0xAe51b702Ee60279307437b13734D27078EF108AA',
    '0x511aA45406238B3366A0b2aCFBef9d5f5A77f382',
    '0x43266c70bb594593BaE660E53F2FF66E0a194cBa',
    '0xd1038dC6FD8e5A728A696d1b9A3fBADBD8c9ED2b',
    '0x368e7BD461251567A3D320E8Ff808937357b0a9A',
  ]
}

export const convertToHash = (text: string): string => {
  return utils.keccak256(utils.toUtf8Bytes(text))
}

export const ETH_ASSET_CLASS = convertToHash('ETH').substring(0, 10)
export const ERC20_ASSET_CLASS = convertToHash('ERC20').substring(0, 10)
export const ERC721_ASSET_CLASS = convertToHash('ERC721').substring(0, 10)
export const ERC1155_ASSET_CLASS = convertToHash('ERC1155').substring(0, 10)
export const COLLECTION = convertToHash('COLLECTION').substring(0, 10)
export const CRYPTO_KITTY = convertToHash('CRYPTO_KITTY').substring(0, 10)

export const checkSum = (input: string): string => {
  return utils.getAddress(input)
}

export const encode = (types: string[], values: any[]): string => {
  return utils.defaultAbiCoder.encode(types, values)
}

export const AddressZero = (): string => {
  return constants.AddressZero
}

export const toCompositeKey = (val1: string, val2: string): string => `${val1}:${val2}`

export const parseBoolean = (str: string): boolean => {
  return _.isString(str)
    ? str === 'true' || str === '1'
    : !!str
}

export const isTrue = (v: boolean): boolean => v === true

export const isFalse = (v: boolean): boolean => v === false

export const isEmpty = <T>(v: T): boolean => {
  if (_.isNumber(v)) {
    return _.isNil(v)
  }
  return _.isEmpty(v)
}

export const isNotEmpty = <T>(v: T): boolean => isFalse(isEmpty(v))

export const safeIn = <T>(arr: T[]): FindOperator<T> =>
  isEmpty(arr) ? In([null]) : In(arr)

export const safeInForOmitBy = <T>(arr: T[]): FindOperator<T> | null =>
  isEmpty(arr) ? null : In(arr)

export const safeObject = <T>(obj: T): T =>
  isEmpty(obj) ? <T>{} : obj

export const removeEmpty = <T>(obj: _.Dictionary<T>): _.Dictionary<T> =>
  _.omitBy<T>(obj, isEmpty)

export const deleteKey = <T>(obj: _.Dictionary<T>, key: string): _.Dictionary<T> =>
  _.omit(obj, key)

export const inputT2SafeK = <T>(
  input: _.Dictionary<any>,
  extra?: Partial<T>,
  key = 'pageInput',
): _.Dictionary<T> => {
  const safe = safeObject(input)
  const withoutKey = deleteKey(safe, key)
  return removeEmpty(withoutKey)
}

export const toUTCDate = (date = new Date()): Date => {
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  )
  return new Date(utc)
}

export const toDate = (date = ''): Date => {
  return isEmpty(date) ? toUTCDate() : toUTCDate(new Date(date))
}

export const toDateIsoString = (date = new Date()): string =>
  toUTCDate(date).toISOString()

export const toTimestamp = (date = new Date()): number =>
  toUTCDate(date).getTime()

// Postgres will return records that **equal** the timestamp, despite
// the strictly-greater-than filter in the SQL.  This ends up returning
// dup records to the frontend.  Workaround: add 1 ms to the timestamp.
export const addMs = (d: Date, ms = 1): Date => {
  d.setMilliseconds(d.getMilliseconds() + ms)
  return d
}

export const subtractMs = (d: Date, ms = 1): Date => {
  d.setMilliseconds(d.getMilliseconds() - ms)
  return d
}

export const lessThan = <T>(v: T): FindOperator<T> => LessThan(v)

export const moreThan = <T>(v: T): FindOperator<T> => MoreThan(v)

export const lessThanDate = (date: string): FindOperator<Date> => lessThan(subtractMs(toDate(date)))

export const moreThanDate = (date: string): FindOperator<Date> => moreThan(addMs(toDate(date)))

export const bigNumber = BigNumber.from

export const bigNumberToHex = (v: unknown): string => bigNumber(v)._hex

export const bigNumberToString = (v: unknown): string => bigNumber(v).toString()

export const bigNumberToNumber = (v: unknown): number => Number(bigNumber(v))

export const tokenDecimals = BigNumber.from(10).pow(18)

export const toSignature = (sig: string): Signature => utils.splitSignature(sig)

export const shortenAddress = (address: string, chars = 4): string => {
  if (isEmpty(address)) {
    return address
  }
  const parsed = utils.getAddress(address)
  return `${parsed.substring(0, chars + 2)}...${parsed.substring(42 - chars)}`
}

export const toFixedValue = (price: string, units = 18): string =>
  utils.formatUnits(bigNumber(price), units)