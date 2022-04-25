import { BigNumber, constants, Signature, utils } from 'ethers'
import * as _ from 'lodash'
import { FindOperator, In, LessThan, MoreThan } from 'typeorm'

import whitelistJSON from '@nftcom/shared/helper/abis/whitelist.json'

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

export function getEnsKeyWhitelist(): Array<string> {
  return [
    'zubairq.eth',
    'zoldyckfamily.eth',
    'zakattack.eth',
    'youngfonz.eth',
    'wei.eth',
    'yongming.eth',
    'yassi.eth',
    'yashpatel.eth',
    'yash patel.eth',
    'xurulean.eth',
    'wpgmd.eth',
    'womenoffuture.eth',
    'witchybits.eth',
    'williewalton.eth',
    'webz.eth',
    'vonshlong.eth',
    'vishlish.eth',
    'victorfun.eth',
    'urconduit.eth',
    'txenergy.eth',
    'twinnytwin.eth',
    'turp0x.eth',
    'tomfarren.eth',
    'todda.eth',
    'tkxyz.eth',
    'tims.eth',
    'timdude.eth',
    'thomason.eth',
    'thereallerbz.eth',
    'tessla.eth',
    'tedcampos.eth',
    'sweetritajune.eth',
    'supermar.eth',
    'sungodnika.eth',
    'sueco.eth',
    'strainwars.eth',
    'stewardstudios.eth',
    'stevenator.eth',
    'stens.eth',
    'soy.eth',
    'sopha.eth',
    'solangelevy.eth',
    'snootch.eth',
    'snipergod.eth',
    'smileôøωôøωôøω.eth',
    'skilloo.eth',
    'skidrowcrypto.eth',
    'sketchpoetic.eth',
    'sissixin.eth',
    'sirbyron.eth',
    'silhouetics.eth',
    'sifuwes.eth',
    'shpilsky.eth',
    'shok.eth',
    'shenna.eth',
    'sgscrap.eth',
    'seemeonthefly.eth',
    'scottjhoward.eth',
    'satoshimama.eth',
    'sankarpothukuchi.eth',
    'salafel.eth',
    'saad.eth',
    'rudyjellis.eth',
    'rotexhawk.eth',
    'romvn.eth',
    'rocketlaunch.eth',
    'robotdevil.eth',
    'riskeverything.eth',
    'rickalee.eth',
    'rick.loopring.eth',
    'raulreyes.eth',
    'rahulsingh.eth',
    'raghu.eth',
    'r0cketman.eth',
    'qwackson.eth',
    'qinhaoyi.eth',
    'puschking.eth',
    'pixelflex.eth',
    'pinksad.eth',
    'phantoma.eth',
    'parzivalx.eth',
    'paracat.eth',
    'pachter.eth',
    'ozsultan.eth',
    'oxcarrie.eth',
    'olshansky.eth',
    'ogando.eth',
    'officialjp.eth',
    'nook.eth',
    'nish88.eth',
    'nikhilsoni.eth',
    'niftybro.eth',
    'nftoni.eth',
    'nftobserver.eth',
    'netnerd.eth',
    'netlens.eth',
    'mrbates.eth',
    'motionmarc.eth',
    'mlitman.eth',
    'mixedground.eth',
    'mixedemotions.eth',
    'misspinkyb.eth',
    'mirrorswellnessclub.eth',
    'mikechase.eth',
    'metabond.eth',
    'melostar.eth',
    'mattyversee.eth',
    'master23mind.eth',
    'masonrizzo.eth',
    'marnixpostma.eth',
    'mallyvai.eth',
    'lyona.eth',
    'lukestokes.eth',
    'lovekey.eth',
    'lostpixel.eth',
    'livinkelana.eth',
    'lietuvis.eth',
    'laustenfound.eth',
    'larryosseimensah.eth',
    'lamarr.eth',
    'lalatina.eth',
    'kushlife.eth',
    'ksmike.eth',
    'kryptologe.eth',
    'knowndistance.eth',
    'keithcomito.eth',
    'kapoli.loopring.eth',
    'justinking.eth',
    'jstrud.eth',
    'jpfarra.eth',
    'jpegmillionaires.eth',
    'jordancuellar.eth',
    'joonian.eth',
    'joemajik.eth',
    'joeconlin.eth',
    'joeatwal.eth',
    'jhyan.eth',
    'jgr.eth',
    'jezutobie.eth',
    'jensenduyvu.eth',
    'jazgarewal.eth',
    'jayhopper.eth',
    'jasthi.eth',
    'jasenx.eth',
    'jakubwarmuz.eth',
    'jaime3.eth',
    'jadler.eth',
    'izdabes.eth',
    'iwendao.eth',
    'intuitiveinvestor.eth',
    'intter.eth',
    'internationalartmachine.eth',
    'innerverse.eth',
    'infusionvictor.eth',
    'iamnftqueen.eth',
    'hunster.eth',
    'hollycopter.eth',
    'hodlandshill.eth',
    'hickle.eth',
    'hevyaf.eth',
    'hescollazo.eth',
    'hapdog.eth',
    'hamling.eth',
    'h1brd.eth',
    'gymtime.eth',
    'guodanpi.eth',
    'gregrae.eth',
    'gilbertini.eth',
    'ghostgirl.eth',
    'gezznz.eth',
    'fremd.eth',
    'flakon.eth',
    'fisser.eth',
    'fezcap.eth',
    'feypousav.eth',
    'felene.eth',
    'fanz.eth',
    'fairydustclub.eth',
    'f0m0guy.eth',
    'excitedforever.eth',
    'evanvar.eth',
    'evank.eth',
    'ethyduzzit.eth',
    'erinruff.eth',
    'ericspivak.eth',
    'epiphyte.eth',
    'endaod.eth',
    'embree.eth',
    'electricpilldao.eth',
    'ekowalow.eth',
    'ehsanasadi.eth',
    'easylink.eth',
    'dynam.eth',
    'dunndeal.eth',
    'ds0uz.loopring.eth',
    'drewroberts.eth',
    'dnycexdesign.eth',
    'dickwizard.eth',
    'derty.eth',
    'defiky.eth',
    'dedavod.eth',
    'debdoot.eth',
    'dbh.eth',
    'davalo.eth',
    'dao88.eth',
    'danp.eth',
    'danieljuni.eth',
    'danblackman.eth',
    'damnyeah.eth',
    'd3tozo.eth',
    'createcodecolor.eth',
    'crash43.eth',
    'courtneylaroc.eth',
    'cosmicsurfer.eth',
    'corbinan.eth',
    'citric.eth',
    'choona.eth',
    'chainb.eth',
    'ceslie.eth',
    'cellarrat.eth',
    'carlosrepolho.eth',
    'carlosjr.eth',
    'caldie.eth',
    'caldeagle.eth',
    'bugra.eth',
    'buer1993.eth',
    'bryanmooney.eth',
    'brothacr.eth',
    'brookr.eth',
    'bpizza.eth',
    'bkb.eth',
    'biyapay.eth',
    'bithomie.eth',
    'bitcoinking.eth',
    'bigmikejax.eth',
    'beastsociety.eth',
    'bearup.eth',
    'babapasha.eth',
    'austinmello.eth',
    'austingjudd.eth',
    'artprgrmr.eth',
    'armpits.eth',
    'arkinho.eth',
    'anastasiau.eth',
    'alvdingo.eth',
    'alika.eth',
    'alexôøωôøωôøωôøω.eth',
    'alexroytenberg.eth',
    'alexbartsch.eth',
    'airdropnews.eth',
    'adrianmartinez.eth',
    'adour.eth',
    'acedabook.eth',
    'acada.eth',
    'aaronleupp.eth',
    '0xtimboslice.eth',
    '0xsbm.eth',
    '0xpooyan.eth',
    '0xgex.eth',
    '424.eth',
    'frankieboi.eth',
    'huangxinstar.eth',
    'leafereum.eth',
    'Nftleaf.eth',
    'Oh.eth',
    'w3sley.eth',
  ]
}

export function getGenesisKeyWhitelist(): Array<string> {
  return whitelistJSON as string[]
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

export const id = (input: string): string => {
  return utils.id(input)
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