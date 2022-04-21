import aws from 'aws-sdk'
import STS from 'aws-sdk/clients/sts'

import { assetBucket, getChain } from '@nftcom/gql/config'
import { Context, gql } from '@nftcom/gql/defs'
import { appError, profileError,walletError } from '@nftcom/gql/error'
import { pagination } from '@nftcom/gql/helper'
import { generateSVG } from '@nftcom/gql/service/generateSVG.service'
import { _logger, defs, entity, fp, helper, repository } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)

// TODO implement cache using data loader otherwise
//  some of these functions will have too many db calls

const getDefaultOrFindById = <T>(
  obj: T,
  id: string,
  findFn: (id: string) => Promise<T>,
  key = 'id',
): Promise<T> => {
  if (helper.isEmpty(id) || obj?.[key] === id) {
    return Promise.resolve(obj)
  }
  return findFn(id)
}

export const getWallet = (
  ctx: Context,
  input: gql.WalletInput,
): Promise<entity.Wallet> => {
  const { network, chainId, address } = input
  const { user, repositories } = ctx
  logger.debug('getWallet', { loggedInUserId: user?.id, input })

  const chain = getChain(network, chainId)
  return repositories.wallet
    .findByNetworkChainAddress(network, chainId, address)
    .then(fp.rejectIfEmpty(appError.buildExists(
      walletError.buildAddressExistsMsg(network, chain, address),
      walletError.ErrorType.AddressAlreadyExists,
    )))
}

// TODO can we use generics instead of any?
export const entityById = (
  ctx: Context,
  id: string,
  entityType: defs.EntityType,
): Promise<any> => {
  const { repositories, user, wallet } = ctx
  //logger.debug('entityById', { loggedInUserId: user?.id, id, entityType })

  switch (entityType) {
  case defs.EntityType.Approval:
    return repositories.approval.findById(id)
  case defs.EntityType.Bid:
    return repositories.bid.findById(id)
  case defs.EntityType.Curation:
    return repositories.curation.findById(id)
  case defs.EntityType.Collection:
    return repositories.collection.findById(id)
  case defs.EntityType.Edge:
    return repositories.edge.findById(id)
  case defs.EntityType.NFT:
    return repositories.nft.findById(id)
  case defs.EntityType.Profile:
    return repositories.profile.findById(id)
  case defs.EntityType.User:
    return getDefaultOrFindById(user, id, repositories.user.findById)
  case defs.EntityType.Wallet:
    return getDefaultOrFindById(wallet, id, repositories.wallet.findById)
  default:
    throw new Error(`Cannot resolve entityType: ${entityType}`)
  }
}

export const resolveEntityFromContext = <T>(key: string) => {
  return (parent: unknown, _: unknown, ctx: Context): Promise<T> => {
    return ctx?.[key]
  }
}

export const resolveEntityById = <T, K>(
  key: string,
  parentType: defs.EntityType,
  resolvingType: defs.EntityType,
) => {
  return (parent: T, args: unknown, ctx: Context): Promise<K> => {
    return entityById(ctx, parent?.['id'], parentType)
      .then((p) => {
        if (helper.isEmpty(p?.[key])) {
          return null
        }
        return entityById(ctx, p?.[key], resolvingType)
      })
  }
}

export const resolveEntityOwnership = <T>(
  key: string,
  ctxKey: string,
  parentType: defs.EntityType,
) => {
  return (parent: T, _: unknown, ctx: Context): Promise<boolean> => {
    const ctxObj = ctx[ctxKey]
    return entityById(ctx, parent?.['id'], parentType)
      .then((p) => ctxObj?.['id'] === p?.[key])
  }
}

export const resolveEdgeOwnership = <T>(ctxKey: string, edgeType: defs.EdgeType) => {
  return (parent: T, _: unknown, ctx: Context): Promise<boolean> => {
    const ctxObj = ctx[ctxKey]
    const { repositories } = ctx
    return repositories.edge.exists({
      edgeType,
      thisEntityId: ctxObj?.['id'],
      thatEntityId: parent?.['id'],
      deletedAt: null,
    })
  }
}

export const entitiesBy = <T>(
  // ctx: Context,
  repo: repository.BaseRepository<T>,
  filter: Partial<T>,
  orderBy: defs.OrderBy = { createdAt: 'DESC' },
): Promise<T[]> => {
  // const { user } = ctx
  // logger.debug('entitiesBy', { loggedInUserId: user.id })
  return repo.find({ where: { ...filter, deletedAt: null }, order: orderBy })
}

/**
 * Cursor based pagination and by default it is sorted based on time desc
 * "before" and "after" in page terms refers to "later" and "earlier" respectively
 *
 *                                cursor
 *               |<-- last n before | first n after -->|
 * 12pm  11am  10am  9am  8am  7am  6am  5am  4am  3am  2am  1am
 */
export const paginatedEntitiesBy = <T>(
  repo: repository.BaseRepository<T>,
  pageInput: gql.PageInput,
  filters: Partial<T>[],
  relations: string[],
  orderKey= 'createdAt',
  orderDirection = 'DESC',
  distinctOn?: defs.DistinctOn<T>,
): Promise<defs.PageableResult<T>> => {
  const pageableFilters = pagination.toPageableFilters(pageInput, filters, orderKey)
  const orderBy = <defs.OrderBy>{ [orderKey]: orderDirection }
  const reversedOrderDirection = orderDirection === 'DESC' ? 'ASC' : 'DESC'
  const reveredOrderBy = <defs.OrderBy>{ [orderKey]: reversedOrderDirection }

  return pagination.resolvePage<T>(pageInput, {
    firstAfter: () => repo.findPageable({
      filters: pageableFilters,
      relations: relations,
      orderBy,
      take: pageInput.first,
      distinctOn,
    }),
    firstBefore: () => repo.findPageable({
      filters: pageableFilters,
      relations: relations,
      orderBy,
      take: pageInput.first,
      distinctOn,
    }),
    lastAfter: () => repo.findPageable({
      filters: pageableFilters,
      relations: relations,
      orderBy: reveredOrderBy,
      take: pageInput.last,
      distinctOn,
    }).then(pagination.reverseResult),
    lastBefore: () => repo.findPageable({
      filters: pageableFilters,
      relations: relations,
      orderBy: reveredOrderBy,
      take: pageInput.last,
      distinctOn,
    }).then(pagination.reverseResult),
  })
}

const entitiesOfEdges = <T>(
  ctx: Context,
  edges: entity.Edge[],
  mapper: <T>(ctx: Context, edge: entity.Edge) => Promise<T>,
): Promise<T[]> => {
  return fp.promiseMap<entity.Edge, T>((edge) => mapper<T>(ctx, edge))(edges)
}

export const thisEntityOfEdge = <T>(ctx: Context, edge: entity.Edge): Promise<T> => {
  return entityById(ctx, edge.thisEntityId, edge.thisEntityType)
}

export const thisEntitiesOfEdges = <T>(ctx: Context) => {
  return (edges: entity.Edge[]): Promise<T[]> => {
    return entitiesOfEdges<T>(ctx, edges, thisEntityOfEdge)
  }
}

export const thisEntitiesOfEdgesBy = <T>(
  ctx: Context,
  filter: Partial<entity.Edge>,
): Promise<T[]> => {
  const { repositories } = ctx
  return entitiesBy(repositories.edge, filter)
    .then(thisEntitiesOfEdges<T>(ctx))
}

export const thatEntityOfEdge = <T>(ctx: Context, edge: entity.Edge): Promise<T> => {
  return entityById(ctx, edge.thatEntityId, edge.thatEntityType)
}

export const thatEntitiesOfEdges = <T>(ctx: Context) => {
  return (edges: entity.Edge[]): Promise<T[]> => {
    return entitiesOfEdges<T>(ctx, edges, thatEntityOfEdge)
  }
}

export const thatEntitiesOfEdgesBy = <T>(
  ctx: Context,
  filter: Partial<entity.Edge>,
): Promise<T[]> => {
  const { repositories } = ctx
  return entitiesBy(repositories.edge, filter)
    .then(thatEntitiesOfEdges(ctx))
}

// TODO use EdgeStats table
export const countEdges = (ctx: Context, filter: Partial<entity.Edge>): Promise<number> => {
  const { repositories } = ctx
  return repositories.edge.count({ ...filter, deletedAt: null })
}

// global object for blacklist profiles
export const blacklistProfiles = {
  'nike': true,
  'first': true,
  'second': true,
  'damn': true,
  'dyke': true,
  'fuck': true,
}

export const blacklistProfilePatterns = [
  /^.*damn$/,
  /^.*dyke$/,
  /^.*fuck.*$/,
  /^.*shit.*$/,
  /^ahole$/,
  /^amcik$/,
  /^andskota$/,
  /^anus$/,
  /^arschloch$/,
  /^arse.*$/,
  /^ash0le$/,
  /^ash0les$/,
  /^asholes$/,
  /^ass$/,
  /^assmonkey$/,
  /^ass_monkey$/,
  /^assface$/,
  /^assh0le$/,
  /^assh0lez$/,
  /^asshole$/,
  /^assholes$/,
  /^assholz$/,
  /^assrammer$/,
  /^asswipe$/,
  /^ayir$/,
  /^azzhole$/,
  /^bitch.*$/,
  /^b00b.*$/,
  /^b17ch$/,
  /^b1tch$/,
  /^bassterds$/,
  /^bastard$/,
  /^bastards$/,
  /^bastardz$/,
  /^basterds$/,
  /^basterdz$/,
  /^bi7ch$/,
  /^biatch$/,
  /^blowjob$/,
  /^boof$/,
  /^boffing$/,
  /^boiolas$/,
  /^bollock.*$/,
  /^boobs$/,
  /^breasts$/,
  /^buceta$/,
  /^buttpirate$/,
  /^butt_pirate$/,
  /^butthole$/,
  /^butt_hole$/,
  /^buttwipe$/,
  /^butt_wipe$/,
  /^c0ck$/,
  /^c0cks$/,
  /^c0k$/,
  /^cabron$/,
  /^carpetmuncher$/,
  /^carpet_muncher$/,
  /^cawk$/,
  /^cawks$/,
  /^cazzo$/,
  /^chink$/,
  /^chraa$/,
  /^chuj$/,
  /^cipa$/,
  /^clit$/,
  /^clits$/,
  /^cnts$/,
  /^cntz$/,
  /^cock$/,
  /^cockhead$/,
  /^cock_head$/,
  /^cocksucker$/,
  /^cock_sucker$/,
  /^crap$/,
  /^cum$/,
  /^cunt.*$/,
  /^d4mn$/,
  /^daygo$/,
  /^dego$/,
  /^dick$/,
  /^dike$/,
  /^dild0$/,
  /^dild0s$/,
  /^dildo$/,
  /^dildos$/,
  /^dilld0$/,
  /^dilld0s$/,
  /^dirsa$/,
  /^dominatricks$/,
  /^dominatrics$/,
  /^dominatrix$/,
  /^dupa$/,
  /^dziwka$/,
  /^ejackulate$/,
  /^ejakulate$/,
  /^ekrem$/,
  /^ekto$/,
  /^enculer$/,
  /^enema$/,
  /^faen$/,
  /^fag$/,
  /^fag1t$/,
  /^faget$/,
  /^fagg1t$/,
  /^faggit$/,
  /^faggot$/,
  /^fagget$/,
  /^fagit$/,
  /^fags$/,
  /^fagz$/,
  /^faig$/,
  /^faigs$/,
  /^fanculo$/,
  /^fanny$/,
  /^fart$/,
  /^fatass$/,
  /^fcuk$/,
  /^feces$/,
  /^feg$/,
  /^felcher$/,
  /^ficken$/,
  /^flikker$/,
  /^flippingthebird$/,
  /^foreskin$/,
  /^fotze$/,
  /^flipping_the_bird$/,
  /^fuck$/,
  /^fudge_packer$/,
  /^fucker$/,
  /^fuckin$/,
  /^fucking$/,
  /^fucks$/,
  /^fudgepacker$/,
  /^fuk$/,
  /^fukah$/,
  /^fuken$/,
  /^fuker$/,
  /^fukin$/,
  /^fukk$/,
  /^fukkah$/,
  /^fukken$/,
  /^fukker$/,
  /^fukkin$/,
  /^futkretzn$/,
  /^fux0r$/,
  /^g00k$/,
  /^gay$/,
  /^gay$/,
  /^gayboy$/,
  /^gaygirl$/,
  /^gays$/,
  /^gayz$/,
  /^god_damned$/,
  /^gook$/,
  /^guiena$/,
  /^h00r$/,
  /^h0ar$/,
  /^h0r$/,
  /^h0re$/,
  /^goddamned$/,
  /^helvete$/,
  /^hoar$/,
  /^hoer.*$/,
  /^honkey$/,
  /^hoor$/,
  /^hoore$/,
  /^hore$/,
  /^huevon$/,
  /^hui$/,
  /^injun$/,
  /^jackoff$/,
  /^jackoff$/,
  /^jap$/,
  /^japs$/,
  /^jerk_off$/,
  /^jerkoff$/,
  /^jisim$/,
  /^jism$/,
  /^jiss$/,
  /^jizm$/,
  /^jizz$/,
  /^jizz$/,
  /^kanker$/,
  /^kawk$/,
  /^kike$/,
  /^klootzak$/,
  /^knob$/,
  /^knobs$/,
  /^knobz$/,
  /^knulle$/,
  /^kraut$/,
  /^kuk$/,
  /^kuksuger$/,
  /^kunt$/,
  /^kunts$/,
  /^kuntz$/,
  /^Kurac$/,
  /^kurwa$/,
  /^kusi$/,
  /^kyrpa$/,
  /^l3itch$/,
  /^lezzian$/,
  /^lipshits$/,
  /^lipshitz$/,
  /^mamhoon$/,
  /^masokist$/,
  /^massterbait$/,
  /^masstrbait$/,
  /^masstrbate$/,
  /^masterbaiter$/,
  /^masterbat$/,
  /^masterbat3$/,
  /^masterbate$/,
  /^masterbates$/,
  /^masturbate$/,
  /^merd$/,
  /^mibun$/,
  /^mofo$/,
  /^monkleigh$/,
  /^mothafucker$/,
  /^mothafuker$/,
  /^mothafukkah$/,
  /^mothafukker$/,
  /^motherfucker$/,
  /^motherfukah$/,
  /^motherfuker$/,
  /^motherfukkah$/,
  /^motherfukker$/,
  /^motha_fucker$/,
  /^motha_fuker$/,
  /^motha_fukkah$/,
  /^motha_fukker$/,
  /^mother_fucker$/,
  /^mother_fukah$/,
  /^mother_fuker$/,
  /^mother_fukkah$/,
  /^mother_fukker$/,
  /^motherfucker$/,
  /^mouliewop$/,
  /^muie$/,
  /^mulkku$/,
  /^muschi$/,
  /^muthafucker$/,
  /^muthafukah$/,
  /^muthafuker$/,
  /^muthafukkah$/,
  /^muthafukker$/,
  /^mutha_fucker$/,
  /^mutha_fukah$/,
  /^mutha_fuker$/,
  /^mutha_fukkah$/,
  /^mutha_fukker$/,
  /^n1gr$/,
  /^nastt$/,
  /^nazi$/,
  /^nazis$/,
  /^nepesaurio$/,
  /^nigga$/,
  /^nigger$/,
  /^nigur$/,
  /^niiger$/,
  /^niigr$/,
  /^nutsack$/,
  /^orafis$/,
  /^orgasim$/,
  /^orgasm$/,
  /^orgasum$/,
  /^oriface$/,
  /^orifice$/,
  /^orifiss$/,
  /^orospu$/,
  /^p0rn$/,
  /^packi$/,
  /^packie$/,
  /^packy$/,
  /^paki$/,
  /^pakie$/,
  /^paky$/,
  /^paska$/,
  /^pecker$/,
  /^peeenus$/,
  /^peeenusss$/,
  /^peenus$/,
  /^peinus$/,
  /^pen1s$/,
  /^penas$/,
  /^penis$/,
  /^penis_breath$/,
  /^penisbreath$/,
  /^penus$/,
  /^penuus$/,
  /^perse$/,
  /^phuc$/,
  /^phuck$/,
  /^phuck$/,
  /^Phuk$/,
  /^phuker$/,
  /^phukker$/,
  /^picka$/,
  /^pierdol$/,
  /^pillu$/,
  /^pimmel$/,
  /^pimpis$/,
  /^pizda$/,
  /^polac$/,
  /^polack$/,
  /^polak$/,
  /^poonani$/,
  /^poontsee$/,
  /^poop$/,
  /^porn$/,
  /^pr0n$/,
  /^pr1c$/,
  /^pr1ck$/,
  /^pr1k$/,
  /^preteen$/,
  /^pula$/,
  /^pule$/,
  /^pusse$/,
  /^pusse$/,
  /^pussee$/,
  /^pussy$/,
  /^pussy$/,
  /^puta$/,
  /^puto$/,
  /^puuke$/,
  /^puuker$/,
  /^qahbeh$/,
  /^queef.*$/,
  /^queer$/,
  /^queers$/,
  /^queerz$/,
  /^qweers$/,
  /^qweerz$/,
  /^qweir$/,
  /^rautenberg$/,
  /^recktum$/,
  /^rectum$/,
  /^retard$/,
  /^scank$/,
  /^schaffer$/,
  /^scheiss$/,
  /^schlampe$/,
  /^schlong$/,
  /^schmuck$/,
  /^screwing$/,
  /^scrotum$/,
  /^semen$/,
  /^sex$/,
  /^sexy$/,
  /^sh1t$/,
  /^sh1ter$/,
  /^sh1ts$/,
  /^sh1tter$/,
  /^sh1tz$/,
  /^sharmuta$/,
  /^sharmute$/,
  /^shemale$/,
  /^shi$/,
  /^shipal$/,
  /^shit$/,
  /^shit$/,
  /^shits$/,
  /^shitter$/,
  /^shitty$/,
  /^shity$/,
  /^shitz$/,
  /^shiz$/,
  /^shyt$/,
  /^shyte$/,
  /^shytty$/,
  /^shyty$/,
  /^skanck$/,
  /^skank$/,
  /^skankee$/,
  /^skankey$/,
  /^skanks$/,
  /^skanky$/,
  /^skribz$/,
  /^skurwysyn$/,
  /^slut$/,
  /^slut$/,
  /^sluts$/,
  /^slutty$/,
  /^slutz$/,
  /^smut$/,
  /^son_of_a_bitch$/,
  /^sonofabitch$/,
  /^sphencter$/,
  /^spic$/,
  /^spierdalaj$/,
  /^splooge$/,
  /^suka$/,
  /^teets$/,
  /^teez$/,
  /^testical$/,
  /^testicle$/,
  /^tit$/,
  /^tits$/,
  /^titt.*$/,
  /^turd$/,
  /^twat$/,
  /^va1jina$/,
  /^vag1na$/,
  /^vagiina$/,
  /^vagina$/,
  /^vaj1na$/,
  /^vajina$/,
  /^vittu$/,
  /^vullva$/,
  /^vulva$/,
  /^w00se$/,
  /^w0p$/,
  /^wank$/,
  /^wank$/,
  /^wetback$/,
  /^wh00r$/,
  /^wh0re$/,
  /^whoar$/,
  /^whore$/,
  /^whore$/,
  /^wichser$/,
  /^wop.*$/,
  /^xrated$/,
  /^xxx$/,
  /^yed$/,
  /^zabourah$/,
]

// global object of reserved profiles mapped to the insider address.
export const reservedProfiles = {
  '0xBD3Feab37Eb7533B03bf77381D699aD8bA64A30B': ['joey1', 'joey2'],
  '0x643367af2Ae07EBFbDE7599eB0855A19c24dca5F': ['jonathan1', 'jonathan2'],
  '0x2f8ECC5A549638630C094a3DB3849f1ba27C31B1': ['kent1', 'kent2'],
  '0x98375cB9Dc4a14b46a4C8b284880C7C277f4c8bc': ['john1' , 'john2'],
  '0x948c21e4e9e342e083424b6132fc29644c6c0a9f': ['john3' , 'john4'],
  '0x341dE5B426d3582f35357094Ae412cf4E41774Cd': ['eddie1', 'eddie2'],
  '0x338eFdd45AE7D010da108f39d293565449C52682': ['gavin1', 'gavin2'],
  '0xF968EC896Ffcb78411328F9EcfAbB9FcCFe4E863': ['anthony1, anthony2'],
  '0xa18376780EB719bA2d2abb02D1c6e4B8689329e0': ['insider1', 'insider2'],
  '0x72dF8ecab91afe22367f4cCA904465Ae7bAF33b8': ['insider3', 'insider4'],
}

export const OFAC = {
  '0x8576aCC5C05D6Ce88f4e49bf65BdF0C62F91353C': true,
  '0x67d40EE1A85bf4a4Bb7Ffae16De985e8427B6b45': true,
  '0x6F1cA141A28907F78Ebaa64fb83A9088b02A8352': true,
  '0x6aCDFBA02D390b97Ac2b2d42A63E85293BCc160e': true,
  '0x48549A34AE37b12F6a30566245176994e17C6b4A': true,
  '0x5512d943eD1f7c8a43F3435C85F7aB68b30121b0': true,
  '0xC455f7fd3e0e12afd51fba5c106909934D8A0e4a': true,
  '0x1da5821544e25c636c1417Ba96Ade4Cf6D2f9B5A': true,
  '0x7Db418b5D567A4e0E8c59Ad71BE1FcE48f3E6107': true,
  '0x72a5843cc08275C8171E582972Aa4fDa8C397B2A': true,
  '0x7F19720A857F834887FC9A7bC0a0fBe7Fc7f8102': true,
  '0x7FF9cFad3877F21d41Da833E2F775dB0569eE3D9': true,
  '0xd882cFc20F52f2599D84b8e8D58C7FB62cfE344b': true,
  '0x901bb9583b24D97e995513C6778dc6888AB6870e': true,
  '0xA7e5d5A720f06526557c513402f2e6B5fA20b008': true,
  '0xfEC8A60023265364D066a1212fDE3930F6Ae8da7': true,
  '0x7F367cC41522cE07553e823bf3be79A889DEbe1B': true,
  '0x9F4cda013E354b8fC285BF4b9A60460cEe7f7Ea9': true,
  '0x3CBdeD43EFdAf0FC77b9C55F6fC9988fCC9b757d': true,
  '0x2f389cE8bD8ff92De3402FFCe4691d17fC4f6535': true,
  '0xe7aa314c77F4233C18C6CC84384A9247c0cf367B': true,
  '0x308eD4B7b49797e1A98D3818bFF6fe5385410370': true,
  '0x19Aa5Fe80D33a56D56c78e82eA5E50E5d80b4Dff': true,
  '0x098B716B8Aaf21512996dC57EB0615e2383E2f96': true,
}

const ethereumRegex = /^(0x)[0-9A-Fa-f]{40}$/
const validProfileRegex = /^[0-9a-z_]{1,100}$/
export const blacklistBool = (inputUrl: string, blockReserved: boolean): boolean => {
  const blacklisted = blacklistProfilePatterns.find((pattern) => pattern.test(inputUrl)) != null
  if (!blockReserved) {
    return blacklisted
  }
  const reserved = Object.keys(reservedProfiles)
    .find((address) => reservedProfiles[address].includes(inputUrl)) != null
  return blacklisted || reserved
}

let cachedSTS: STS = null
const getSTS = (): STS => {
  if (helper.isEmpty(cachedSTS)) {
    cachedSTS = new STS()
  }
  return cachedSTS
}

export const getAWSConfig = async (): Promise<aws.S3> => {
  const sessionName = `upload-file-to-asset-bucket-${helper.toTimestamp()}`
  const params: STS.AssumeRoleRequest = {
    RoleArn: assetBucket.role,
    RoleSessionName: sessionName,
  }
  const response = await getSTS().assumeRole(params).promise()
  aws.config.update({
    accessKeyId: response.Credentials.AccessKeyId,
    secretAccessKey: response.Credentials.SecretAccessKey,
    sessionToken: response.Credentials.SessionToken,
  })
  return new aws.S3()
}

export const generateCompositeImage = async ( profileURL: string): Promise<string> => {
  const url = profileURL.length > 14 ? profileURL.slice(0, 12).concat('...') : profileURL
  // 1. generate placeholder image buffer with profile url...
  const buffer = generateSVG(url.toUpperCase())
  // 2. upload buffer to s3...
  const s3 = await getAWSConfig()
  const imageKey = Date.now().toString() + '-' + profileURL + '.svg'
  try {
    const res = await s3.upload({
      Bucket: assetBucket.name,
      Key: imageKey,
      Body: buffer,
      ContentType: 'image/svg+xml',
    }).promise()
    return res.Location
  } catch (e) {
    logger.debug('generateCompositeImage', e)
    throw e
  }
}

export const createProfile = (
  ctx: Context,
  profile: Partial<entity.Profile>,
): Promise<entity.Profile> => {
  return ctx.repositories.profile.findByURL(profile.url)
    .then(fp.thruIfEmpty((profile) =>
      Promise.all([
        fp.rejectIf((profile: Partial<entity.Profile>) => !validProfileRegex.test(profile.url))(
          appError.buildExists(
            profileError.buildProfileInvalidCharMsg(profile.url),
            profileError.ErrorType.ProfileInvalid,
          )),
        fp.rejectIf((profile: Partial<entity.Profile>) => ethereumRegex.test(profile.url))(
          appError.buildExists(
            profileError.buildProfileInvalidEthMsg(profile.url),
            profileError.ErrorType.ProfileInvalid,
          )),
        fp.rejectIf((profile: Partial<entity.Profile>) => blacklistBool(profile.url, false))(
          appError.buildExists(
            profileError.buildProfileInvalidBlacklistMsg(profile.url),
            profileError.ErrorType.ProfileInvalid,
          )),
      ]),
    ))
    .then(() => ctx.repositories.profile.save(profile)
      .then((savedProfile: entity.Profile) =>
        generateCompositeImage(savedProfile.url)
          .then((imageURL: string) =>
            ctx.repositories.profile.updateOneById(savedProfile.id, { photoURL: imageURL }))))
}

export const createEdge = (
  ctx: Context,
  edge: Partial<entity.Edge>,
): Promise<entity.Edge> => {
  return ctx.repositories.edge.save(edge)
}
