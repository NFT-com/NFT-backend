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
    '0xSbm.eth',
    'Alvdingo.eth',
    'babapasha.eth',
    'bugra.eth',
    'Choona.eth',
    'd3tozo.eth',
    'easylink.eth',
    'ekowalow.eth',
    'Endaod.eth',
    'Ethyduzzit.eth',
    'fisser.eth',
    'Gezznz.eth',
    'ghostgirl.eth',
    'gilbertini.eth',
    'hamling.eth',
    'jadler.eth',
    'jaime3.eth',
    'jasthi.eth',
    'joemajik.eth',
    'jordancuellar.eth',
    'jpfarra.eth',
    'justinking.eth',
    'Knowndistance.eth',
    'LaustenFound.eth',
    'lietuvis.eth',
    'livinkelana.eth',
    'lostpixel.eth',
    'lovekey.eth',
    'mallyvai.eth',
    'metabond.eth',
    'Mirrorswellnessclub.eth',
    'misspinkyb.eth',
    'mlitman.eth',
    'nftobserver.eth',
    'NFToni.eth',
    'nikhilsoni.eth',
    'Nish88.eth',
    'ox4ee48bb12C2FeFBe6021bDD14A6ec2c2009DbA45',
    'OxB62595AeaEDe1a90c3877a868af32015Ddea205d',
    'parzivalx.eth',
    'Phantoma.eth',
    'pixelflex.eth',
    'rocketlaunch.eth',
    'shenna.eth',
    'shok.eth',
    'silhouetics.eth',
    'skilloo.eth',
    'stens.eth',
    'stevenator.eth',
    'tessla.eth',
    'tims.eth',
    'txenergy.eth',
    'vonshlong.eth',
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
    'vishlish.eth',
    'victorfun.eth',
    'urconduit.eth',
    'twinnytwin.eth',
    'turp0x.eth',
    'tomfarren.eth',
    'todda.eth',
    'tkxyz.eth',
    'timdude.eth',
    'thomason.eth',
    'thereallerbz.eth',
    'tedcampos.eth',
    'sweetritajune.eth',
    'supermar.eth',
    'sungodnika.eth',
    'sueco.eth',
    'strainwars.eth',
    'stewardstudios.eth',
    'soy.eth',
    'sopha.eth',
    'solangelevy.eth',
    'snootch.eth',
    'snipergod.eth',
    'smileôøωôøωôøω.eth',
    'skidrowcrypto.eth',
    'sketchpoetic.eth',
    'sissixin.eth',
    'sirbyron.eth',
    'sifuwes.eth',
    'shpilsky.eth',
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
    'pinksad.eth',
    'phantoma.eth',
    'paracat.eth',
    'pachter.eth',
    'ozsultan.eth',
    'oxcarrie.eth',
    'olshansky.eth',
    'ogando.eth',
    'officialjp.eth',
    'nook.eth',
    'nish88.eth',
    'niftybro.eth',
    'nftoni.eth',
    'netnerd.eth',
    'netlens.eth',
    'mrbates.eth',
    'motionmarc.eth',
    'mixedground.eth',
    'mixedemotions.eth',
    'mirrorswellnessclub.eth',
    'mikechase.eth',
    'melostar.eth',
    'mattyversee.eth',
    'master23mind.eth',
    'masonrizzo.eth',
    'marnixpostma.eth',
    'lyona.eth',
    'lukestokes.eth',
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
    'jstrud.eth',
    'jpegmillionaires.eth',
    'joonian.eth',
    'joeconlin.eth',
    'joeatwal.eth',
    'jhyan.eth',
    'jgr.eth',
    'jezutobie.eth',
    'jensenduyvu.eth',
    'jazgarewal.eth',
    'jayhopper.eth',
    'jasenx.eth',
    'jakubwarmuz.eth',
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
    'h1brd.eth',
    'gymtime.eth',
    'guodanpi.eth',
    'gregrae.eth',
    'gezznz.eth',
    'fremd.eth',
    'flakon.eth',
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
    'ehsanasadi.eth',
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
    'nftleaf.eth',
    'oh.eth',
    'w3sley.eth',
    '0xgex.eth',
    '0xpooyan.eth',
    '0xtimboslice.eth',
    '424.eth',
    'aaronleupp.eth',
    'acada.eth',
    'acedabook.eth',
    'adour.eth',
    'adrianmartinez.eth',
    'adrianmartinez.eth',
    'airdropnews.eth',
    'alex💰.eth',
    'alexbartsch.eth',
    'alika.eth',
    'alika.eth',
    'alika.eth',
    'arkinho.eth',
    'armpits.eth',
    'artprgrmr.eth',
    'ashudubey.eth',
    'austingjudd.eth',
    'austinmello.eth',
    'bearup.eth',
    'beastsociety.eth',
    'bigmikejax.eth',
    'bitcoinking.eth',
    'bithomie.eth',
    'biyapay.eth',
    'bkb.eth',
    'bpizza.eth',
    'brookr.eth',
    'brothacr.eth',
    'bryanmooney.eth',
    'buer1993.eth',
    'caldeagle.eth',
    'caldie.eth',
    'carlosjr.eth',
    'carlosrepolho.eth',
    'cellarrat.eth',
    'ceslie.eth',
    'chainb.eth',
    'citric.eth',
    'connorgo.eth',
    'corbinan.eth',
    'cosmicsurfer.eth',
    'courtneylaroc.eth',
    'crash43.eth',
    'crash43.eth',
    'createcodecolor.eth',
    'cryptoclue.eth',
    'cryptoganzo.eth',
    'damnyeah.eth',
    'damnyeah.eth',
    'danblackman.eth',
    'danieljuni.eth',
    'danieljuni.eth',
    'danieljuni.eth',
    'danp.eth',
    'dao88.eth',
    'davalo.eth',
    'dbh.eth',
    'debdoot.eth',
    'dedavod.eth',
    'defiky.eth',
    'derty.eth',
    'devenspear.eth',
    'devenspear.eth',
    'dickwizard.eth',
    'drewroberts.eth',
    'ds0uz.loopring.eth',
    'dunndeal.eth',
    'dynam.eth',
    'edwllcxn.eth',
    'ehsanasadi.eth',
    'electricpilldao.eth',
    'embree.eth',
    'epiphyte.eth',
    'ericspivak.eth',
    'erinruff.eth',
    'evank.eth',
    'evanvar.eth',
    'excitedforever.eth',
    'f0m0guy.eth',
    'fairydustclub.eth',
    'felene.eth',
    'feypousav.eth',
    'fezcap.eth',
    'flakon.eth',
    'frankieboi.eth',
    'fremd.eth',
    'gobzy.eth',
    'gregrae.eth',
    'guodanpi.eth',
    'gymtime.eth',
    'h1brd.eth',
    'hamling.eth',
    'hapdog.eth',
    'hescollazo.eth',
    'hevyaf.eth',
    'hickle.eth',
    'hodlandshill.eth',
    'hollycopter.eth',
    'huangxinstar.eth',
    'hunster.eth',
    'iamkuba.eth',
    'iamnftqueen.eth',
    'infusionvictor.eth',
    'innerverse.eth',
    'internationalartmachine.eth',
    'intter.eth',
    'intuitiveinvestor.eth',
    'iwendao.eth',
    'izdabes.eth',
    'jakubwarmuz.eth',
    'jasenx.eth',
    'jayhopper.eth',
    'jazgarewal.eth',
    'jensenduyvu.eth',
    'jezutobie.eth',
    'jezutobie.eth',
    'jezutobie.eth',
    'jezutobie.eth',
    'jezutobie.eth',
    'jezutobie.eth',
    'jezutobie.eth',
    'jezutobie.eth',
    'jezutobie.eth',
    'jezutobie.eth',
    'jezutobie.eth',
    'jezutobie.eth',
    'jgr.eth',
    'jhyan.eth',
    'joeatwal.eth',
    'joeconlin.eth',
    'joonian.eth',
    'jpegmillionaires.eth',
    'jstrud.eth',
    'kapoli.loopring.eth',
    'keithcomito.eth',
    'kryptologe.eth',
    'ksmike.eth',
    'kushlife.eth',
    'lalatina.eth',
    'lamarr.eth',
    'larryosseimensah.eth',
    'larryosseimensah.eth',
    'leafereum.eth',
    'lorien.loopring.eth',
    'lukestokes.eth',
    'lyona.eth',
    'marnixpostma.eth',
    'masonrizzo.eth',
    'master23mind.eth',
    'mattyversee.eth',
    'melostar.eth',
    'mikechase.eth',
    'mikechase.eth',
    'misspinkyb.eth',
    'mixedemotions.eth',
    'mixedground.eth',
    'motionmarc.eth',
    'mrbates.eth',
    'mrbates.eth',
    'netlens.eth',
    'netnerd.eth',
    'nftleaf.eth',
    'niftybro.eth',
    'nook.eth',
    'officialjp.eth',
    'ogando.eth',
    'ogando.eth',
    'oh.eth',
    'olshansky.eth',
    'oxcarrie.eth',
    'ozsultan.eth',
    'ozsultan.eth',
    'pachter.eth',
    'pachter.eth',
    'paracat.eth',
    'paracat.eth',
    'pardesco.eth',
    'pinksad.eth',
    'puschking.eth',
    'qinhaoyi.eth',
    'qwackson.eth',
    'r0cketman.eth',
    'raghu.eth',
    'rahulsingh.eth',
    'raulreyes.eth',
    'rick.loopring.eth',
    'rickalee.eth',
    'riskeverything.eth',
    'robotdevil.eth',
    'romvn.eth',
    'rotexhawk.eth',
    'rudyjellis.eth',
    'saad.eth',
    'salafel.eth',
    'sankarpothukuchi.eth',
    'satoshimama.eth',
    'scottjhoward.eth',
    'seemeonthefly.eth',
    'seemeonthefly.eth',
    'sgscrap.eth',
    'shpilsky.eth',
    'sifuwes.eth',
    'silhouetics.eth',
    'silhouetics.eth',
    'silhouetics.eth',
    'silhouetics.eth',
    'sirbyron.eth',
    'sissixin.eth',
    'sissixin.eth',
    'sketchpoetic.eth',
    'skidrowcrypto.eth',
    'smile☺.eth',
    'snipergod.eth',
    'snootch.eth',
    'solangelevy.eth',
    'sopha.eth',
    'soy.eth',
    'speed.eth',
    'stewardstudios.eth',
    'strainwars.eth',
    'sueco.eth',
    'sungodnika.eth',
    'supermar.eth',
    'sweetritajune.eth',
    'tedcampos.eth',
    'thereallerbz.eth',
    'thomason.eth',
    'timdude.eth',
    'tkxyz.eth',
    'todda.eth',
    'tomfarren.eth',
    'turp0x.eth',
    'twinnytwin.eth',
    'urconduit.eth',
    'victorfun.eth',
    'victorfun.eth',
    'vishlish.eth',
    'vsadovy.eth',
    'w3sley.eth',
    'webz.eth',
    'williewalton.eth',
    'womenoffuture.eth',
    'wpgmd.eth',
    'xurulean.eth',
    'yashpatel.eth',
    'yashpatel.eth',
    'yassi.eth',
    'yongming.eth',
    'youngfonz.eth',
    'zakattack.eth',
    'zoldyckfamily.eth',
    'zubairq.eth',
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