import { BigNumber, constants, Signature, utils } from 'ethers'
import * as _ from 'lodash'
import { FindOperator, In, LessThan, MoreThan } from 'typeorm'

import whitelistJSON from '@nftcom/shared/helper/abis/whitelist.json'

export const stringListToMap = (str: string, listSep = '|', kvSep = ':'): Map<string, string> => {
  const list = str.split(listSep)
  return list.reduce((agg: Map<string, string>, val: string) => {
    const kv = val.split(kvSep)
    agg.set(kv[0], kv[1])
    return agg
  }, new Map<string, string>())
}

export function getEnsKeyWhitelist(): Array<string> {
  return [
    '0xcarrie.eth',
    '0xfarrah.eth',
    '0xgex.eth',
    '0xpooyan.eth',
    '0xsbm.eth',
    '0xtimboslice.eth',
    '424.eth',
    'aaronleupp.eth',
    'acada.eth',
    'acedabook.eth',
    'adour.eth',
    'adrianmartinez.eth',
    'airdropnews.eth',
    'alcoco.eth',
    'alexbartsch.eth',
    'alexroytenberg.eth',
    'alexôøωôøωôøωôøω.eth',
    'alex💰.eth',
    'alexüí∞.eth',
    'alika.eth',
    'alvdingo.eth',
    'anastasiau.eth',
    'andreachiampo.eth',
    'andrewbark.eth',
    'angieluxd.eth',
    'aramos.eth',
    'arefeh.eth',
    'arkinho.eth',
    'armpits.eth',
    'artprgrmr.eth',
    'artunity.eth',
    'ashudubey.eth',
    'austingjudd.eth',
    'austinmello.eth',
    'austinvisual.eth',
    'babapasha.eth',
    'barth.eth',
    'bearup.eth',
    'beastsociety.eth',
    'bennyblanco888.eth',
    'bigmikejax.eth',
    'bitcoinking.eth',
    'bithomie.eth',
    'biyapay.eth',
    'bkb.eth',
    'booka.eth',
    'bpizza.eth',
    'brandon parker.eth',
    'brandonparker.eth',
    'brookr.eth',
    'brothacr.eth',
    'bryanmooney.eth',
    'buer1993.eth',
    'bugra.eth',
    'bule.eth',
    'caldeagle.eth',
    'caldie.eth',
    'carlosjr.eth',
    'carlosrepolho.eth',
    'cellarrat.eth',
    'ceslie.eth',
    'chainb.eth',
    'chidicharles.eth',
    'chin3o.eth',
    'choona.eth',
    'citric.eth',
    'clintbyars.eth',
    'connnor.eth',
    'connorgo.eth',
    'corbinan.eth',
    'cosmicsurfer.eth',
    'courtneylaroc.eth',
    'crash43.eth',
    'createcodecolor.eth',
    'cryptnet.eth',
    'cryptoclue.eth',
    'cryptoganzo.eth',
    'd3tozo.eth',
    'dabrew.eth',
    'damnyeah.eth',
    'danblackman.eth',
    'danieljuni.eth',
    'danp.eth',
    'dao88.eth',
    'davalo.eth',
    'daveking.eth',
    'dbh.eth',
    'debdoot.eth',
    'dedavod.eth',
    'defiky.eth',
    'derty.eth',
    'designspace.eth',
    'desultor.eth',
    'devenspear.eth',
    'dickwizard.eth',
    'dnycexdesign.eth',
    'dokuzburak.eth',
    'dontfeedthewolf.eth',
    'drebin.eth',
    'drenfx.eth',
    'drewaustin.eth',
    'drewroberts.eth',
    'ds0uz.loopring.eth',
    'dunndeal.eth',
    'dylancasey.eth',
    'dynam.eth',
    'eastwood274.pcc.eth',
    'easylink.eth',
    'edwllcxn.eth',
    'ehsanasadi.eth',
    'ekowalow.eth',
    'el-profesor.eth',
    'electricpilldao.eth',
    'embree.eth',
    'endaod.eth',
    'epiphyte.eth',
    'ericspivak.eth',
    'erinruff.eth',
    'ethyduzzit.eth',
    'evank.eth',
    'evanvar.eth',
    'excitedforever.eth',
    'f0m0guy.eth',
    'fairydustclub.eth',
    'fanz.eth',
    'fawzi.eth',
    'felene.eth',
    'feypousav.eth',
    'fezcap.eth',
    'fisser.eth',
    'flakon.eth',
    'frankieboi.eth',
    'frankiraine.eth',
    'freedomsdao.eth',
    'fremd.eth',
    'gabie.eth',
    'gezznz.eth',
    'ghostgirl.eth',
    'gilbertini.eth',
    'gobzy.eth',
    'gregrae.eth',
    'groggy.eth',
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
    'iartsometimes.eth',
    'infokg.loopring.eth',
    'infusionvictor.eth',
    'innerverse.eth',
    'internationalartmachine.eth',
    'intter.eth',
    'intuitiveinvestor.eth',
    'itsjack.eth',
    'itsrusty.eth',
    'iwendao.eth',
    'izdabes.eth',
    'jadler.eth',
    'jaehyun.eth',
    'jaime3.eth',
    'jakubwarmuz.eth',
    'jasenx.eth',
    'jasonmeinzer.eth',
    'jassioberai.eth',
    'jasthi.eth',
    'jayhopper.eth',
    'jaymesrogers.eth',
    'jazgarewal.eth',
    'jensenduyvu.eth',
    'jessecory.eth',
    'jesseroos.eth',
    'jezutobie.eth',
    'jgr.eth',
    'jhuffman.eth',
    'jhyan.eth',
    'joeatwal.eth',
    'joeconlin.eth',
    'joemajik.eth',
    'jonfu.eth',
    'joonian.eth',
    'jordancuellar.eth',
    'josephchicas.eth',
    'jpegmillionaires.eth',
    'jpfarra.eth',
    'jstrud.eth',
    'justinking.eth',
    'kable.eth',
    'kandyboi.eth',
    'kapoli.loopring.eth',
    'keithcomito.eth',
    'kevinmoy.eth',
    'knowndistance.eth',
    'kobashi.eth',
    'kryptologe.eth',
    'ksmike.eth',
    'kushlife.eth',
    'lalatina.eth',
    'lamarr.eth',
    'lambojo.eth',
    'larryosseimensah.eth',
    'laustenfound.eth',
    'leafereum.eth',
    'libertytreenfts.eth',
    'lietuvis.eth',
    'liupeng.eth',
    'livinkelana.eth',
    'lorien.loopring.eth',
    'lostpixel.eth',
    'lovekey.eth',
    'lowpass.eth',
    'luis.eth',
    'lukestokes.eth',
    'lyona.eth',
    'maddiegoldberg.eth',
    'mallyvai.eth',
    'marnixpostma.eth',
    'masonrizzo.eth',
    'master23mind.eth',
    'matthewhirschey.eth',
    'mattness.eth',
    'mattyversee.eth',
    'mcpherson.eth',
    'melostar.eth',
    'meta peek.eth',
    'metabond.eth',
    'michaelconnery.eth',
    'midazofol.eth',
    'mikechase.eth',
    'miniratman.eth',
    'mirrorswellnessclub.eth',
    'misspinkyb.eth',
    'mixedemotions.eth',
    'mixedground.eth',
    'mlitman.eth',
    'monicahenson.eth',
    'motionmarc.eth',
    'mrbates.eth',
    'msizz.eth',
    'mubashariqbal.eth',
    'nerdyraver.eth',
    'netlens.eth',
    'netnerd.eth',
    'nftleaf.eth',
    'nftobserver.eth',
    'nftoni.eth',
    'niftybro.eth',
    'nikhilsoni.eth',
    'nish88.eth',
    'nlw.eth',
    'nnftoni.eth',
    'nook.eth',
    'officialjp.eth',
    'ogando.eth',
    'oh.eth',
    'olshansky.eth',
    'oxcarrie.eth',
    'ozsultan.eth',
    'pachter.eth',
    'paracat.eth',
    'pardesco.eth',
    'parzivalx.eth',
    'paulmsmith.eth',
    'phantoma.eth',
    'pinksad.eth',
    'pixelflex.eth',
    'pizzayolo.eth',
    'powehi.eth',
    'printerpunk.eth',
    'puschking.eth',
    'qinhaoyi.eth',
    'qwackson.eth',
    'r0bster97.eth',
    'r0cketman.eth',
    'raghu.eth',
    'rahulsingh.eth',
    'raulreyes.eth',
    'rgmakes.eth',
    'rick.loopring.eth',
    'rickalee.eth',
    'riskeverything.eth',
    'robotdevil.eth',
    'rocketlaunch.eth',
    'romvn.eth',
    'room303.eth',
    'roseyrozay.eth',
    'rotexhawk.eth',
    'rudyjellis.eth',
    'ryanstruck.eth',
    'ryghtideas.eth',
    's7ephenson.eth',
    'saad.eth',
    'salafel.eth',
    'sandrajessica.eth',
    'sankarpothukuchi.eth',
    'satoshimama.eth',
    'scizors.eth',
    'scottjhoward.eth',
    'seemeonthefly.eth',
    'sgscrap.eth',
    'shenna.eth',
    'shok.eth',
    'shpilsky.eth',
    'sifuwes.eth',
    'silhouetics.eth',
    'sinemetu11.eth',
    'sirbyron.eth',
    'sissixin.eth',
    'sketchpoetic.eth',
    'skidrowcrypto.eth',
    'skilloo.eth',
    'smileôøωôøωôøω.eth',
    'smile‚ò∫.eth',
    'smile☺.eth',
    'snipergod.eth',
    'snootch.eth',
    'solangelevy.eth',
    'sopha.eth',
    'soy.eth',
    'speed.eth',
    'spudster.eth',
    'sreeranj.eth',
    'stens.eth',
    'stevek.eth',
    'stevenator.eth',
    'stewardstudios.eth',
    'strainwars.eth',
    'streetpapi.eth',
    'sueco.eth',
    'sund3vil27.pcc.eth',
    'sungodnika.eth',
    'sunnychopra.eth',
    'supermar.eth',
    'sweetritajune.eth',
    'tbdrone.eth',
    'tedcampos.eth',
    'tekflx.eth',
    'tessla.eth',
    'theoceancalles.eth',
    'thereallerbz.eth',
    'thet-800.eth',
    'thomason.eth',
    'timdude.eth',
    'tims.eth',
    'tirre.eth',
    'tkxyz.eth',
    'todda.eth',
    'tomfarren.eth',
    'trial0r.eth',
    'tripluca.eth',
    'turp0x.eth',
    'twinnytwin.eth',
    'txenergy.eth',
    'urconduit.eth',
    'vanguardbots.eth',
    'vatsalaggarwal.eth',
    'verifryd.eth',
    'vhafonso.eth',
    'victorfun.eth',
    'vishlish.eth',
    'vladlunin.eth',
    'vonshlong.eth',
    'vsadovy.eth',
    'w3sley.eth',
    'wbbandco.eth',
    'webz.eth',
    'wei.eth',
    'williewalton.eth',
    'witchybits.eth',
    'womenoffuture.eth',
    'wondermundo.eth',
    'wpgmd.eth',
    'xurulean.eth',
    'yash patel.eth',
    'yashpatel.eth',
    'yassi.eth',
    'yinyee.eth',
    'yongming.eth',
    'youngfonz.eth',
    'zakattack.eth',
    'zcvxg.eth',
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
  return _.isString(str) ? str === 'true' || str === '1' : !!str
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

export const safeIn = <T>(arr: T[]): FindOperator<T> => (isEmpty(arr) ? In([null]) : In(arr))

export const safeInForOmitBy = <T>(arr: T[]): FindOperator<T> | null => (isEmpty(arr) ? null : In(arr))

export const safeObject = <T>(obj: T): T => (isEmpty(obj) ? <T>{} : obj)

export const removeEmpty = <T>(obj: _.Dictionary<T>): _.Dictionary<T> => _.omitBy<T>(obj, isEmpty)

export const deleteKey = <T>(obj: _.Dictionary<T>, key: string): _.Dictionary<T> => _.omit(obj, key)

export const inputT2SafeK = <T>(input: _.Dictionary<any>, extra?: Partial<T>, key = 'pageInput'): _.Dictionary<T> => {
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

export const toDateIsoString = (date = new Date()): string => toUTCDate(date).toISOString()

export const toTimestamp = (date = new Date()): number => toUTCDate(date).getTime()

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

export const toFixedValue = (price: string, units = 18): string => utils.formatUnits(bigNumber(price), units)
