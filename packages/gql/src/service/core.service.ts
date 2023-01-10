import axios from 'axios'
import cryptoRandomString from 'crypto-random-string'
import { addDays } from 'date-fns'
import { BigNumber, ethers } from 'ethers'
import imageToBase64 from 'image-to-base64'
import { isNil } from 'lodash'
import fetch from 'node-fetch'
import { FindManyOptions, FindOptionsOrder, IsNull } from 'typeorm'

import { S3Client } from '@aws-sdk/client-s3'
import { AssumeRoleRequest,STS } from '@aws-sdk/client-sts'
import { Upload } from '@aws-sdk/lib-storage'
import { Result } from '@ethersproject/abi'
import { Contract } from '@ethersproject/contracts'
import { cache } from '@nftcom/cache'
import { appError, profileError, walletError } from '@nftcom/error-types'
import { assetBucket } from '@nftcom/gql/config'
import { Context, gql } from '@nftcom/gql/defs'
import { auth, pagination } from '@nftcom/gql/helper'
import { sendgrid } from '@nftcom/gql/service'
import { generateSVG } from '@nftcom/gql/service/generateSVG.service'
import { nullPhotoBase64 } from '@nftcom/gql/service/nullPhoto.base64'
import { _logger, db, defs, entity, fp, helper, provider, repository } from '@nftcom/shared'
import { ProfileTask } from '@nftcom/shared/defs'
import Multicall2 from '@nftcom/shared/helper/abis/Multicall2.json'
import * as Sentry from '@sentry/node'

const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)
export const DEFAULT_NFT_IMAGE = 'https://cdn.nft.com/Medallion.jpg'
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

  return repositories.wallet
    .findByNetworkChainAddress(network, chainId, address)
    .then(fp.rejectIfEmpty(appError.buildExists(
      walletError.buildAddressNotFoundMsg(),
      walletError.ErrorType.AddressNotFound,
    )))
}

// TODO can we use generics instead of any?
export const entityById = (
  ctx: Context,
  id: string,
  entityType: defs.EntityType,
): Promise<any> => {
  const { repositories, user, wallet } = ctx

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

export const getCollection = (
  ctx: Context,
  contractAddress: string,
): Promise<any> => {
  const { user, repositories } = ctx
  logger.debug('getCollection', { loggedInUserId: user?.id, contractAddress })

  return repositories.collection
    .findOne({ where: { contract: contractAddress } })
    .then(fp.rejectIfEmpty(appError.buildCustom(`collection ${contractAddress} not found`)))
}

export const resolveCollectionById = <T, K>(
  key: string,
  parentType: defs.EntityType,
) => {
  return (parent: T, args: unknown, ctx: Context): Promise<K> => {
    return entityById(ctx, parent?.['id'], parentType)
      .then((p) => {
        if (helper.isEmpty(p?.[key])) {
          return null
        }
        return getCollection(ctx, p?.[key])
      })
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
      deletedAt: IsNull(),
    })
  }
}

export const entitiesBy = <T>(
  // ctx: Context,
  repo: repository.BaseRepository<any>,
  filter: Partial<T>,
  orderBy: FindOptionsOrder<any> = { createdAt: 'DESC' },
): Promise<T[]> => {
  // const { user } = ctx
  // logger.debug('entitiesBy', { loggedInUserId: user.id })
  return repo.find({ where: { ...filter, deletedAt: IsNull() }, order: orderBy })
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
): Promise<defs.PageableResult<T>> => {
  const pageableFilters = pagination.toPageableFilters(pageInput, filters, orderKey)
  const orderBy = <FindOptionsOrder<any>>{ [orderKey]: orderDirection }
  const reversedOrderDirection = orderDirection === 'DESC' ? 'ASC' : 'DESC'
  const reversedOrderBy = <FindOptionsOrder<any>>{ [orderKey]: reversedOrderDirection }

  return pagination.resolvePage<T>(pageInput, {
    firstAfter: () => repo.findPageable({
      where: pageableFilters,
      relations: relations,
      order: orderBy,
      take: pageInput.first,
    } as FindManyOptions<T>),
    firstBefore: () => repo.findPageable({
      where: pageableFilters,
      relations: relations,
      order: orderBy,
      take: pageInput.first,
    } as FindManyOptions<T>),
    lastAfter: () => repo.findPageable({
      where: pageableFilters,
      relations: relations,
      order: reversedOrderBy,
      take: pageInput.last,
    } as FindManyOptions<T>).then(pagination.reverseResult),
    lastBefore: () => repo.findPageable({
      where: pageableFilters,
      relations: relations,
      order: reversedOrderBy,
      take: pageInput.last,
    } as FindManyOptions<T>).then(pagination.reverseResult),
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

export const stringifyTraits = (
  nft: entity.NFT,
): entity.NFT => {
  if (nft.metadata && nft.metadata?.traits && nft.metadata.traits?.length) {
    for ( let i = 0; i < nft.metadata.traits.length; i ++) {
      if (nft.metadata.traits[i].value) {
        if (typeof nft.metadata.traits[i].value !== 'string')
          nft.metadata.traits[i].value = JSON.stringify(nft.metadata.traits[i].value)
      }

      // if trait rarity exists
      if (nft.metadata.traits[i].rarity) {
        if (typeof nft.metadata.traits[i].rarity !== 'string')
          nft.metadata.traits[i].rarity = JSON.stringify(nft.metadata.traits[i].rarity)
      }
    }
  }
  return nft
}

export const paginatedThatEntitiesOfEdgesBy = <T>(
  ctx: Context,
  repo: repository.BaseRepository<any>,
  filter: Partial<entity.Edge>,
  pageInput: gql.PageInput,
  orderKey= 'createdAt',
  orderDirection = 'DESC',
  chainId: string,
  entityName?: string,
  entityFilter?: Partial<any>,
): Promise<any> => {
  const { repositories } = ctx
  return paginatedEntitiesBy(
    repositories.edge,
    pageInput,
    [{ ...filter }],
    [],
    orderKey,
    orderDirection,
  ).then((result: defs.PageableResult<entity.Edge>) => {
    const edges = result[0] as entity.Edge[]
    if (entityName === 'NFT') {
      return Promise.all(
        edges.map((edge: entity.Edge) => {
          return entityFilter ?
            repositories.nft.findOne({ where: { id: edge.thatEntityId, ...entityFilter } }) :
            repositories.nft.findOne({ where: { id: edge.thatEntityId } })
              .then(fp.thruIfNotEmpty((entry: entity.NFT) => {
                // fix (short-term) : trait value
                const updatedEntry = stringifyTraits(entry)
                // include visibility to entry
                const newEntry = {
                  ...updatedEntry,
                  isHide: edge.hide,
                }
                return repositories.collection.findOne({ where: {
                  contract: entry.contract,
                  isSpam: false,
                  chainId,
                } })
                  .then(fp.thruIfNotEmpty(() => newEntry))
              } ))
        }),
      ).then((entries: T[]) => {
        const filteredEntries = entries.filter((entry) => !isNil(entry))
        return [filteredEntries, result[1]]
      }).then(pagination.toPageable(pageInput, edges[0], edges[edges.length - 1], orderKey))
    } else {
      return Promise.all(
        edges.map((edge: entity.Edge) => {
          return entityFilter ?
            repo.findOne({ where: { id: edge.thatEntityId, ...entityFilter } }) :
            repo.findOne({ where: { id: edge.thatEntityId } })
              .then(fp.thruIfNotEmpty((entry: T) => entry,
              ))
        }),
      ).then((entries: T[]) => {
        const filteredEntries = entries.filter((entry) => entry !== undefined)
        return [filteredEntries, result[1]]
      }).then(pagination.toPageable(pageInput, edges[0], edges[edges.length - 1], orderKey))
    }
  })
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

export const countEdges = (ctx: Context, filter: Partial<any>): Promise<number> => {
  const { repositories } = ctx
  return repositories.edge.count({ ...filter, deletedAt: IsNull() })
}

// global object for blacklist profiles

export const blacklistProfilePatterns = [
  // final ban list:
  /^.*ch1ld_p0rn.*$/,
  /^.*ch1ldp0rn.*$/,
  /^.*ch1ldporn.*$/,
  /^.*ch1nk.*$/,
  /^.*child_p0rn.*$/,
  /^.*child_porn.*$/,
  /^.*childp0rn.*$/,
  /^.*childporn.*$/,
  /^.*chink.*$/,
  /^.*fag.*$/,
  /^.*fagg0t.*$/,
  /^.*faggot.*$/,
  /^.*g00k.*$/,
  /^.*g0ok.*$/,
  /^.*go0k.*$/,
  /^.*gook.*$/,
  /^.*gook.*$/,
  /^.*hitler.*$/,
  /^.*k1ddyp0rn.*$/,
  /^.*k1ddyporn.*$/,
  /^.*k1dp0rn.*$/,
  /^.*k1dporn.*$/,
  /^.*k1dyp0rn.*$/,
  /^.*kiddie_porn.*$/,
  /^.*kidp0rn.*$/,
  /^.*n1gr.*$/,
  /^.*nazi.*$/,
  /^.*nazis.*$/,
  /^.*nigga.*$/,
  /^.*niggar.*$/,
  /^.*nigger.*$/,
  /^.*niggor.*$/,
  /^.*niggur.*$/,
  /^.*nigur.*$/,
  /^.*niiger.*$/,
  /^.*niigr.*$/,
  /^.*packi.*$/,
  /^.*packie.*$/,
  /^.*packy.*$/,
  /^.*pakie.*$/,
  /^.*swastica.*$/,
  /^.*swastika.*$/,
  /^amcik$/,
  /^andskota$/,
  /^ayir$/,
  /^cp$/,
  /^feg$/,
  /^injun$/,
  /^kike$/,
  /^paki$/,
  /^paky$/,
  /^wop$/,
  // "reserved" list
  /^anonymice$/,
  /^fees$/,
  /^app$/,
  /^whitelist$/,
  /^dao$/,
  /^announcements$/,
  /^bus$/,
  /^discord$/,
  /^hasu$/,
  /^kevinrose$/,
  /^moonbirds$/,
  /^gmoney$/,
  /^j1mmy$/,
  /^snoopdogg$/ ,
  /^farokh$/,
  /^beeple$/,
  /^deezefi$/,
  /^realmissnft$/,
  /^ohhshiny$/,
  /^charlielee$/,
  /^alexbecker$/,
  /^pranksy$/,
  /^pussyriot$/,
  /^cozomo$/,
  /^planb$/ ,
  /^naval$/,
  /^sushiswap$/,
  /^uniswap$/,
  /^erikvoorhees$/,
  /^cdixon$/,
  /^jrnycrypto$/ ,
  /^nickszabo$/,
  /^deeze$/ ,
  /^elliotrades$/,
  /^dcinvestor$/,
  /^brycent$/,
  /^andreas$/,
  /^gmoney$/,
  /^andrewwang$/,
  /^rogerver$/,
  /^crediblecrypto$/,
  /^ericksnowfro$/,
  /^girlgonecrypto$/,
  /^worldofwomen$/,
  /^womenincrypto$/,
  /^bossbabesnft$/,
  /^bossbeautiesnft$/,
  /^mybff$/,
  /^womenrisenft$/,
  /^cryptocoven$/,
  /^samczsun$/,
  /^mdudas$/,
  /^6529$/,
  /^jackmallers$/,
  /^4156$/,
  /^flur$/,
  /^pak$/,
  /^loom$/,
  /^cryptofinally$/,
  /^thecryptomist$/,
  /^lopp$/,
  /^danheld$/,
  /^ljxie$/,
  /^arjunblj$/,
  /^mevcollector$/ ,
  /^wil$/,
  /^brettmalinowski$/,
  /^cantino$/,
  /^beanie$/,
  /^nftcomofficial$/,
  /^nftdotcom$/,
  /^nftcom$/,
  /^nftdotcomoffcial$/,
  /^ethernity$/,
  /^pussyriot$/,
  /^pussyrrriot$/,
  /^pplpleasr$/,
  /^wolfofwallstreet$/,
  /^officialwolfofwallstreet$/,
  /^officialwolfofwallst$/,
  /^officialjordanbelfort$/,
  /^jordanbelfortofficial$/,
  /^cryptohayes$/,
  /^garyv$/,
  /^veefriends$/,
  /^loreal$/,
  /^supernormal$/,
  /^andrewchoi$/,
  /^cryptodads$/,
  /^nftviking$/,
  /^cryptomoms$/,
  /^dogepound$/,
  /^johnlemon$/,
  /^rocnation$/,
  /^cockpunch$/,
  /^timferriss$/,
  /^ud$/,
  /^udp$/,
  /^premintxyz$/,
  /^nftwineclub$/,
  /^wineclub$/,
  /^unstoppabledomains$/,
  /^unstoppableeth$/,
  /^orangecomet$/,
  /^saintrobotica$/,
  /^lostminers$/,
  /^macroverse$/,
  /^allurebridals$/,
  /^thealopecians$/,
]

// global object of reserved profiles mapped to the insider address.
export const reservedProfiles = {
  // final insider reserved list:
  '0xA06B01381c267318f2D65F05bE343c7A2e224713': ['miami', 'miamimind'],
  '0x6430B6b425657C3823683948638fe24431946efF': ['alec', 'eth'],
  '0xCd514eaE987A5A619e7F7EAf7D143fAAAe7fd289': ['guy', 'dude'],
  '0xCDD6a63FeC8c5Dab5f10a139761aa5aCf729317E': ['alex', 'ross'],
  '0xce6489bb151a73Fe82999443e8Ba6AF1571C28c9': ['wizards', 'earth'],
  '0x78C5Fa233Eb07486333B91aCA0A6CFa198B24459': ['a', 'am'],
  '0x7fEE3D50AE036F3E72071dDBa811F58472995Edc': ['z', 'nfts'],
  '0x731ce77e9940e346DDDED2De1219c0F910d1Ff1d': ['anthony', 'radian'],
  '0x38a55929d4047aC9192De1bE35f9a957E4D03FA7': ['soccer', 'universal'],
  '0x12F37431468eb75c2a825e2Cf8Fde773aD94c8EA': ['ar', 'electricfeel'],
  '0x9f0d3E5aA86c242DbAB469486Fa4C2Ec04974A9a': ['nftgrails', 'averyandon'],
  '0xc2D558E4556B09519649749DC702D804E1F71FD4': ['lovewatts', 'knowgood'],
  '0x5257B8a48Ff01182617f2Fd25E9C1dB0b2dD6475': ['balajis', '1729'],
  '0x54D1F8745aB57c29d0Cec4877e75028Fe37689f1': ['bengreenfield', 'bengreenfieldlife'],
  '0x5aEfCB0F364AdbAFC197f91c8496a488bA90C3d1': ['fitness', 'longevity'],
  '0x2e50870053A015409269d9f9e26D3A6869887020': ['ben', 'tiktok'],
  '0xAe51b702Ee60279307437b13734D27078EF108AA': ['billy', 'newyork'],
  '0x577C0eEDccEbF9E0eeD9F64962535C56692e9FC1': ['hodl', 'p2e'],
  '0xcDe8B26f837A77A22d95bA2701c68D3E96351287': ['sex', '0'],
  '0xaCCc711035b1D2EBE8B184d4798AcF434f549103': ['brock', 'pierce'],
  '0x615E4c654Ba4a81970d9c3Ff25A3F602bB384045': ['artpartner', 'art_partner'],
  '0x3F99345b567054BC89950Cb96e189FaF7e1bd0d4': ['chris', 'tesla'],
  '0xCe90a7949bb78892F159F428D0dC23a8E3584d75': ['cozomomedici', 'cozomo'],
  '0xd5B94091505B8D578B154BE895D060fB1615ea84': ['crystal', 'unicorn'],
  '0x1e75E1c7e430b9a6863B531cfe6b3820d82b42f8': ['meta', 'pepsi'],
  '0x4C88FE50000606F1E61fE3F6Fa501423e2f60553': ['daniel', '2lads'],
  '0x68e750DD425d962f255D3a10Ea649F52be58fe18': ['don', 'donald'],
  '0xF6c3c3621F42Ec1F1CD1207Bb1571d93646Ab29A': ['voskcoin', 'vosk'],
  '0x46E83273B865829CBE193642741ae46cC65463e0': ['art', 'drue'],
  '0x86C8203Fe8F7d60Afaa0bddA4d92cc5abd901578': ['kim', 'matt'],
  '0xd83B7Af20636b7e1A0d62b5600B5ABf8d49D4C96': ['buddy', 'towner'],
  '0x56a065dFEB4616f89aD733003914A8e11dB6CEdD': ['fergal', 'fernando_galarcio'],
  '0x2a2E938eC0b8E2bD534795dE09AE722b78f46a3e': ['decentralized', 'sharemyart'],
  '0x8cb377959625E693986c6AdeF82fFF01d4d91aF8': ['fungibles', 'probablynothing'],
  '0x916D113ca8FbF529ab2565B2D528eF979b8f8004': ['gareb', 'shamus'],
  '0xe5660Eb0fB9BBF7B7Aa9736f521099CDA3fB21D6': ['cars', 'rentals'],
  '0xb56E74b28CFa1C4e4d30591227a02B5879155BAF': ['cryptosrus', 'mint'],
  '0xA593C8F83f8Ddaa378Fb9450B9dd29413069E420': ['crypto_tech_women', 'ctw'],
  '0x3B883B85Fd41b81Ef23B6041248bC6AC0b1C04A7': ['happy', 'david'],
  '0xB367697500a8C69439E9fC50908316C7a9E32DfA': ['eep', 'stories'],
  '0x491853781E02F974d6Fa18d8A2186bb4a4ca6977': ['nike', 'gucci'],
  '0xadA2f10a38B513c550F08DC4C8FEAEa3909F1a1B': ['porn', 'tokenmetrics'],
  '0x09726B46170FD47AC945912a6C0d69454f6445AA': ['fifa', 'nhl'],
  '0x37a3549d89a881b66529e82164bab42235981693': ['jakepaul', 'boxing'],
  '0xaa4629DfA35955FE83770c2e4c670152dbB25970': ['jamesandrews', 'djrichcacao'],
  '0x3C312Db5bC3af511e20Dcc8b256Ca887dfa9BF1C': ['playstation', 'trump'],
  '0xBc74c3Adc2aa6A85bda3Eca5b0E235CA08532772': ['genart', 'artnome'],
  '0xA25A8C2658E0b3a0649811A47Ed3bBfdcAB5Cf71': ['jason', 'jb'],
  '0xC345420194D9Bac1a4b8f698507Fda9ecB2E3005': ['jasonliu19920126', 'jasonliu1992'],
  '0x3D50F0ec1a0825365CF3E6BBA90a67C37D08B77f': ['jv', 'jasonve'],
  '0xFda1e9cd11BA632005838f48367fc9e38E2B8EFB': ['faceflower', 'photography'],
  '0xe333681e63Ac0a4b063B0576DEC14dFf894bF8f0': ['music', 'money'],
  '0x1e82eDe518Dad3e385cFC0AD52203911D254bc91': ['jeff', 'antiques'],
  '0x8952D923F4D957725F699603afD44Da6Bdc748A5': ['detroit', 'chicago'],
  '0x58d0f3dA9C97dE3c39f481e146f3568081d328a2': ['computers', 'business'],
  '0xaC72e2fa06f52De2352F1548F00858E81C6d39C0': ['entertainment', 'shopping'],
  '0x5c09f8b380140E40A4ADc744F9B199a9383553F9': ['joey', 'jp'],
  '0xAf68eFa7F52DF54C6888b53bD4AC66803Dc92A5b': ['nft', 'crypto'],
  '0xA0493410c8EAb06CbE48418021DcbacDB04303Ab': ['johngeiger', 'geiger'],
  '0xC9d4f1d9CAc71AE773dab932d01138f04Fc9e01f': ['stoopidbuddy', 'harvatine'],
  '0x78908a90A5e8AB9Fd0DbcA58E7aDE532Cf2c8667': ['lgbt', 'john'],
  '0x7F04084166e1F2478B8f7a99FafBA4238c7dDA83': ['real_estate', 'watches'],
  '0xa4e2367CF24a1AC4E06b4D94B9660730e6d35a25': ['wolfofwallst', 'jordanbelfort'],
  '0xc97F36837e25C150a22A9a5FBDd2445366F11245': ['j', 'jordan'],
  '0x5ABD046d91D8610D1BD2Bed6b4CA56Dde1a23AbF': ['nifty', 'onestop'],
  '0x6b0591697B8CFc114738B77F13dDDD2f013E2681': ['cryptoprofit', 'cryptoprofityt'],
  '0x0448fb5d1E640eED801e7b98c26624834AaEb89b': ['sports', 'metamoney'],
  '0x7F8B5bdd5Cf38C425E93c54a9D8b924fD16a0a1F': ['jchains', 'cryptojchains'],
  '0x6AC9e51CA18B78307Fe7DF2A01CD3b871F6348D0': ['ijustine', 'jpig'],
  '0x5b4245dC95831B0a10868aC09559b92cF36C8d8D': ['blizzardentertainment', 'fromsoftware'],
  '0xC857283243E3367dA2c79e6127B25B8f96e276ff': ['me', 'king'],
  '0x0d23B68cD7fBc3afA097f14ba047Ca2C1da64349': ['km', 'makishima'],
  '0x7a3a08f41fa1a97e23783C04ff1095598ce0132c': ['kevincage', 'kevincageofficial'],
  '0xF45B6966E588c5286D4397256B74bb9bfCf24296': ['mrwonderful', 'kevinoleary'],
  '0xf9142440D22CE022b5d88062a0b0dce0149e5F65': ['khurram', 'logic'],
  '0xa18376780EB719bA2d2abb02D1c6e4B8689329e0': ['k', 's'],
  '0x321dF32c66A18D4e085705d50325040a7dC9d76A': ['cryptozombie', 'zombie'],
  '0x0088601C5F3E3D4ea452FBbC181Ed2d333a81460': ['larryantoine', 'larry'],
  '0xdc36F82FC3C6331975fB20C74d01B378f1d0EB78': ['gallery', 'lighthouse'],
  '0xb74F011dac5862822FdF29Fb73dcdE7bCFDaBa7a': ['loganpaul', 'originals'],
  '0x4a5978Ba7C240347280Cdfb5dfaFbb1E87d25af8': ['metagirl', 'andersen'],
  '0x4c4c22c0C670607F5fd519d78c89925158f5Fe59': ['superbuddy', 'wizmatts'],
  '0xe95455414169FD5C89FAC460412a81A1daEe452e': ['amazon', 'irl'],
  '0xD26812Bb71b7455B4837461c5FbB9BACCF6E938C': ['shoes', 'sneakers'],
  '0x738dF6bFd711d04416dAA15B10E309Fdf5Dd5945': ['nickyads', 'nickadler'],
  '0x89CA82624F453647ED6e9Ce5Ca5b25aB8F7f0Bf6': ['ninachanel', 'jet'],
  '0xC55f9f7F8662f7c0Da4643d1105D84Ad3Ac8dcF8': ['pilpeled', 'israel'],
  '0xb5AEddc7336a1aA2D18D6De315931972bEc2901B': ['byblood', 'x'],
  '0x88fd66ee0Da6B621290070E3d4CaB71907DB02B6': ['busyjordy', 'crypto_corner'],
  '0xf4615A18A0AC709D07d3EDc7a295fdAAfa6aBe1C': ['fomo', 'fomosapiens'],
  '0x56a9D77b41A80f0f499f56DFb8Cc2Bcf17c66CC8': ['rice', 'ricetvx'],
  '0xE86a716D6D3C4B85bF4cdD5c1BDe24C9865e5eC4': ['rogerrai007', 'mmp'],
  '0xbC828Cb03771DF942B79DaAF7d36266357A902f8': ['metaverse', 'play'],
  '0x1BD05549fD62785fE6fF7a4f7c4678c6b7025964': ['cryptofiend', 'crypto_fiend'],
  '0xDB10C51DdC6bCFced9Eb0e17D1020a006e9063BD': ['elonmusk', 'punk'],
  '0xEDbD2C0a9a813789ba6F2eD5427f6c0bb9D2e906': ['seth', 'sethgreen'],
  '0xB83145BE4164C42A28800BCeB056a4A1e58d2844': ['apple', 'alphabet'],
  '0x714610543F367F6c12390Fcfd40608DF4e9567C7': ['shonduras', 'notshonduras'],
  '0x4911E3049a846A2495C2474d45a4d578AbDeAEAB': ['gaming', 'cryptostache'],
  '0x67bF9c5a79C676A6D446cC391DB632704EB0f020': ['shiralazar', 'shira'],
  '0x67Ff9934c797DD104F86F6FAcc7feF23D8a6f9e3': ['twiitch', 'twiitchcreative'],
  '0xE98E91c49F26eCE72770a34554CA696F9043e7d8': ['zahira', 'hiphop'],
  '0xA9Fe952EdD2958aB7Dea126c6d8B4413AfD3E771': ['todd', 'picasso'],
  '0xc5B746bDe254F5B88f4F906AafbD788EB282c760': ['nba', 'pfp'],
  '0x9E3508a1dE57a459835a2DFDc451afa7677962DD': ['trading', 'tomcrown'],
  '0x05AE0683d8B39D13950c053E70538f5810737bC5': ['philosophy', 'conspiracy'],
  '0x3651c09BfAEccc9D03EB8f7181Ce58082377DA25': ['spirituality', 'metaphysics'],
  '0x8Dbbca57Ea56290Efa14D835bBfd34fAF1d89753': ['vonmises', 'vmvault'],
  '0xE0Ae80592E0be32f899A448FA927929530FCf2c5': ['fruit', 'vegetable'],
  '0xfA3ccA6a31E30Bf9A0133a679d33357bb282c995': ['yale', 'y'],
  '0x1Bd8814B90372cc92e7FE0785948c981618cAa78': ['web3_plaza', 'pantherpunks'],
  '0xAd5B657416fbA43CAF6C65Ec8e8DD847d6700286': ['oscars', 'cokecola'],
  '0xdc7B03E4F3a7B85F7A20e594D14a59B072000dfb': ['upperdeck', 'worldseries'],
  '0x6F41a9ab54f7665314768Ebd72AF6bB97c6D85dA': ['bearbrick', 'happydad'],
  '0x1623e9C3dE4D23e6dDF408Dcfa895AD64a63b6c4': ['baltimoreravens', 'livenation'],
  '0x7C594337490Fab2f846b87E4016ECc8893A0659c': ['wme', 'wrestling'],
  '0xB807D0789E5086bDf7D0A66d12406dB40fc8Bc90': ['mezcal', 'basel'],
  '0xD1ac1e553E029f5dE5732C041DfC9f8CEd937A20': ['venice', 'venicemusic'],
  '0x1598535C9e05E2130F9F239B2F23215166Bb41a7': ['scottdonnell', 'heromaker'],
  '0x54D07CFa91F05Fe3B45d8810feF05705117AFe53': ['wiseadvice', 'moneyguru'],
  '0x367721b332F4697d440EBBe6780262411Fd03409': ['mooncatmoments'],
  '0xb8C11BEda7142ae7986726247f548Eb0C3CDE474': ['mooncatpop'],
  '0x09C61c41C8C5D378CAd80523044C065648Eaa654': ['mooncatpopvm'],
  '0xc3f733ca98E0daD0386979Eb96fb1722A1A05E69': ['mooncats'],
  '0x1e9385eE28c5C7d33F3472f732Fb08CE3ceBce1F': ['lootprintsformc'],
  '0xECDD2F733bD20E56865750eBcE33f17Da0bEE461': ['cryptodads'],
  '0x9A7364b902557850ed11cAb9eF4C61710fc51692': ['nftviking'],
  '0x99654fd49C0E51b8029d2ba7DE5b99734aB7AFEC': ['cryptomoms'],
  '0x078928DDB9AF4B363880C29F926CFd0F82E86D69': ['supernormal', 'zipcy'],
  '0x1fFA64E82C677B550aa239Ef81Aa57A9658C691a': ['andrewchoi'],
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
  '0xa0e1c89Ef1a489c9C7dE96311eD5Ce5D32c20E4B': true,
  '0x3Cffd56B47B7b41c56258D9C7731ABaDc360E073': true,
  '0x53b6936513e738f44FB50d2b9476730C0Ab3Bfc1': true,
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
    cachedSTS = new STS({ region: process.env.AWS_REGION })
  }
  return cachedSTS
}

export const convertEthAddressToEns = async (
  ethAddress: string,
): Promise<string> => {
  try {
    const ens = await provider.provider().lookupAddress(ethAddress)
    return ens
  } catch (e) {
    Sentry.captureException(e)
    Sentry.captureMessage(`error converting eth address to ens: ${JSON.stringify(e)}`)
    return `error converting eth address to ens: ${JSON.stringify(e)}`
  }
}

export const convertEnsToEthAddress = async (
  ensAddress: string,
): Promise<string> => {
  try {
    const address = await provider.provider().resolveName(ensAddress?.toLowerCase())
    return address
  } catch (e) {
    Sentry.captureException(e)
    Sentry.captureMessage(`error converting ens to eth address: ${JSON.stringify(e)}`)
    return `error converting ens to eth address: ${JSON.stringify(e)}`
  }
}

export const getAWSConfig = async (): Promise<S3Client> => {
  const sessionName = `upload-file-to-asset-bucket-${helper.toTimestamp()}`
  const params: AssumeRoleRequest = {
    RoleArn: assetBucket.role,
    RoleSessionName: sessionName,
  }
  const response = await getSTS().assumeRole(params)
  const accessKeyId = response.Credentials.AccessKeyId
  const secretAccessKey = response.Credentials.SecretAccessKey
  const sessionToken = response.Credentials.SessionToken

  return new S3Client({ credentials: { accessKeyId,secretAccessKey,sessionToken } })
}

export const s3ToCdn = (s3URL: string): string => {
  if (s3URL.indexOf('nftcom-dev-assets') > -1) {
    return s3URL.replace('https://nftcom-dev-assets.s3.amazonaws.com/', 'https://cdn.nft.com/dev/')
  } else if (s3URL.indexOf('nftcom-staging-assets') > -1) {
    return s3URL.replace('https://nftcom-staging-assets.s3.amazonaws.com/', 'https://cdn.nft.com/staging/')
  } else if (s3URL.indexOf('nftcom-prod-assets') > -1) {
    return s3URL.replace('https://nftcom-prod-assets.s3.amazonaws.com/', 'https://cdn.nft.com/')
  } else {
    return s3URL
  }
}

export const generateCompositeImage = async (
  profileURL: string,
  defaultImagePath: string,
): Promise<string> => {
  const url = profileURL.length > 14 ? profileURL.slice(0, 12).concat('...') : profileURL
  // 1. generate placeholder image buffer with profile url...
  let buffer
  if (defaultImagePath === DEFAULT_NFT_IMAGE) {
    buffer = generateSVG(url.toUpperCase(), nullPhotoBase64)
  } else {
    try {
      const base64String = await imageToBase64(defaultImagePath)
      buffer = generateSVG(url.toUpperCase(), base64String)
    } catch (e) {
      Sentry.captureException(e)
      Sentry.captureMessage(`Error while svg generation: ${e}`)
      throw e
    }
  }
  // 2. upload buffer to s3...
  const s3config = await getAWSConfig()
  const imageKey = 'profiles/' + Date.now().toString() + '-' + profileURL + '.svg'
  try {
    const upload = new Upload({
      client: s3config,
      params: {
        Bucket: assetBucket.name,
        Key: imageKey,
        Body: buffer,
        ContentType: 'image/svg+xml',
      },
    })
    upload.done()

    return s3ToCdn(`https://${assetBucket.name}.s3.amazonaws.com/${imageKey}`)
  } catch (e) {
    logger.debug('generateCompositeImage', e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error while uploading svg to S3: ${e}`)
    throw e
  }
}

export const createProfile = (
  ctx: Context,
  profile: Partial<entity.Profile>,
  noAvatar?: boolean,
): Promise<entity.Profile> => {
  return ctx.repositories.profile.findOne({ where: { url: profile.url, chainId: profile.chainId } })
    .then(fp.thruIfEmpty(() => {
      return Promise.all([
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
      ])
    }))
    .then(() => {
      return ctx.repositories.profile.save(profile)
        .then((savedProfile: entity.Profile) => {
          if (!noAvatar) {
            return generateCompositeImage(savedProfile.url, DEFAULT_NFT_IMAGE)
              .then((imageURL: string) =>
                ctx.repositories.profile.updateOneById(
                  savedProfile.id,
                  {
                    photoURL: imageURL,
                    bannerURL: 'https://cdn.nft.com/profile-banner-default-logo-key.png',
                    description: `NFT.com profile for ${savedProfile.url}`,
                  },
                ))
          } else {
            return savedProfile
          }
        })
    })
}

export const createProfileFromEvent = async (
  chainId: string,
  owner: string,
  tokenId: BigNumber,
  repositories: db.Repository,
  profileUrl: string,
  noAvatar?: boolean,
): Promise<entity.Profile> => {
  try {
    let wallet = await repositories.wallet.findByChainAddress(chainId, ethers.utils.getAddress(owner))
    let user
    if (!wallet) {
      const chain = auth.verifyAndGetNetworkChain('ethereum', chainId)
      user = await repositories.user.findOne({
        where: {
          // defaults
          username: 'ethereum-' + ethers.utils.getAddress(owner),
        },
      })

      if (!user) {
        user = await repositories.user.save({
          // defaults
          username: 'ethereum-' + ethers.utils.getAddress(owner),
          referralId: cryptoRandomString({ length: 10, type: 'url-safe' }),
        })
      }
      wallet = await repositories.wallet.save({
        address: ethers.utils.getAddress(owner),
        network: 'ethereum',
        chainId: chainId,
        chainName: chain.name,
        userId: user.id,
      })
    }
    const ctx = {
      chain: {
        id: wallet.chainId,
        name: wallet.chainName,
      },
      network: 'Ethereum',
      repositories: repositories,
      user: null,
      wallet,
    }
    const profile = await createProfile(ctx, {
      status: defs.ProfileStatus.Owned,
      url: profileUrl,
      tokenId: tokenId.toString(),
      ownerWalletId: wallet.id,
      ownerUserId: wallet.userId,
      chainId: chainId || process.env.CHAIN_ID,
    }, noAvatar)
    logger.info('Save incentive action for CREATE_NFT_PROFILE')
    // save incentive action for CREATE_NFT_PROFILE
    const createProfileAction = await repositories.incentiveAction.findOne({
      where: {
        userId: wallet.userId,
        profileUrl,
        task: defs.ProfileTask.CREATE_NFT_PROFILE,
      },
    })
    if (!createProfileAction) {
      await repositories.incentiveAction.save({
        userId: wallet.userId,
        profileUrl,
        task: defs.ProfileTask.CREATE_NFT_PROFILE,
        point: defs.ProfileTaskPoint.CREATE_NFT_PROFILE,
      })
      logger.info('Saved incentive action for CREATE_NFT_PROFILE')
    }
    user = await repositories.user.findOne({
      where: {
        // defaults
        username: 'ethereum-' + ethers.utils.getAddress(owner),
      },
    })
    logger.info('Save incentive action for REFER_NETWORK')
    //save incentive action for REFER_NETWORK
    if (user && user.referredBy) {
      const referredInfo = user.referredBy.split('::')
      if (referredInfo && referredInfo.length === 2) {
        const userMadeReferral = await repositories.user.findById(referredInfo[0])
        const referredProfileUrl = referredInfo[1]
        if (userMadeReferral) {
          const referNetworkAction = await repositories.incentiveAction.findOne({
            where: {
              userId: userMadeReferral.id,
              profileUrl: referredProfileUrl,
              task: defs.ProfileTask.REFER_NETWORK,
            },
          })
          if (!referNetworkAction) {
            await repositories.incentiveAction.save({
              userId: userMadeReferral.id,
              profileUrl: referredProfileUrl,
              task: defs.ProfileTask.REFER_NETWORK,
              point: defs.ProfileTaskPoint.REFER_NETWORK,
            })
            logger.info('Saved incentive action for REFER_NETWORK')
          }
        }
      }
    }
    return profile
  } catch (err) {
    logger.error(`Error in createProfileFromEvent: ${err}`)
  }
}

export const saveUsersForAssociatedAddress = async (
  chainId: string,
  address: string,
  repositories: db.Repository,
): Promise<entity.Wallet> => {
  const wallet = await repositories.wallet.findByChainAddress(
    chainId,
    ethers.utils.getAddress(address),
  )
  if (!wallet) {
    const chain = auth.verifyAndGetNetworkChain('ethereum', chainId)
    let user = await repositories.user.findOne({
      where: {
        username: 'ethereum-' + ethers.utils.getAddress(address),
      },
    })

    if (!user) {
      user = await repositories.user.save({
        // defaults
        username: 'ethereum-' + ethers.utils.getAddress(address),
        referralId: cryptoRandomString({ length: 10, type: 'url-safe' }),
      })
    }
    return await repositories.wallet.save({
      address: ethers.utils.getAddress(address),
      network: 'ethereum',
      chainId: chainId,
      chainName: chain.name,
      userId: user.id,
    })
  } else return wallet
}

export const createEdge = (
  ctx: Context,
  edge: Partial<entity.Edge>,
): Promise<entity.Edge> => {
  return ctx.repositories.edge.save(edge)
}

const replaceAt = (index: number, str: string, replacement): string => {
  return str.substring(0, index) + replacement + str.substring(index + replacement.length)
}

/**
 * Generate next weight from previous weight
 * This method is always used to save new edges which are not existing on edge table.
 * If length of previous weight is bigger than 4, we cut it to 4.
 * i.e. aaaa -> aaab, aaaz -> aaba, azzz -> zaaa, aaaan -> aaab
 * @param prevWeight
 */

export const generateWeight = (prevWeight: string | undefined): string => {
  if (!prevWeight) return 'aaaa'
  const weight = prevWeight.length > 4 ? prevWeight.slice(0, 4) : prevWeight
  let order = weight
  let update = String.fromCharCode(weight.charCodeAt(3) + 1)
  if (update <= 'z') {
    order = replaceAt(3, order, update)
  } else {
    update = String.fromCharCode(weight.charCodeAt(2) + 1)
    if (update <= 'z') {
      order = replaceAt(2, order, update)
    } else {
      update = String.fromCharCode(weight.charCodeAt(1) + 1)
      if (update <= 'z') {
        order = replaceAt(1, order, update)
      } else {
        update = String.fromCharCode(weight.charCodeAt(0) + 1)
        order = replaceAt(0, order, update)
        order = replaceAt(1, order, 'a')
      }
      order = replaceAt(2, order, 'a')
    }
    order = replaceAt(3, order, 'a')
  }
  return order
}

/**
 * Generate middle weight using previous and next weight
 * This method is always used to insert weight of existing edge between two edges.
 * i.e. abcde ~ abchi -> abcf, abc ~ abchi -> abcd,
 * abhs ~ abit -> abhw, abh ~ abit -> abhn,
 * Detailed explanation for this method is below.
 * https://stackoverflow.com/questions/38923376/return-a-new-string-that-sorts-between-two-given-strings/38927158#38927158
 * @param prev
 * @param next
 */
export const midWeight = (prev: string, next: string): string => {
  let p, n, pos, str
  // find leftmost non-matching character
  for (pos = 0; p == n; pos++) {
    p = pos < prev.length ? prev.charCodeAt(pos) : 96
    n = pos < next.length ? next.charCodeAt(pos) : 123
  }
  // copy identical part of string
  str = prev.slice(0, pos - 1)
  // prev string equals beginning of next
  if (p == 96) {
    // next character is 'a'
    while (n == 97) {
      // get char from next
      n = pos < next.length ? next.charCodeAt(pos++) : 123
      // insert an 'a' to match the 'a'
      str += 'a'
    }
    // next character is 'b'
    if (n == 98) {
      // insert an 'a' to match the 'b'
      str += 'a'
      // set to end of alphabet
      n = 123
    }
  }
  // found consecutive characters
  else if (p + 1 == n) {
    // insert character from prev
    str += String.fromCharCode(p)
    // set to end of alphabet
    n = 123
    // p='z'
    while ((p = pos < prev.length ? prev.charCodeAt(pos++) : 96) == 122) {
      // insert 'z' to match 'z'
      str += 'z'
    }
  }
  // append middle character
  return str + String.fromCharCode(Math.ceil((p + n) / 2))
}

/**
 * Get the biggest weight of edges for profile NFTs
 * We may want to use this method before action to save new edges on edge table for profile NFTs
 * @param repositories
 * @param profileId
 */
export const getLastWeight = async (
  repositories: db.Repository,
  profileId: string,
): Promise<string | undefined> => {
  const edges = await repositories.edge.find({ where: {
    thisEntityType: defs.EntityType.Profile,
    thatEntityType: defs.EntityType.NFT,
    thisEntityId: profileId,
    edgeType: defs.EdgeType.Displays,
  } })
  if (!edges.length) return
  const filterEdges = edges.filter((edge) => edge.weight !== null)
  if (!filterEdges.length) return
  let biggest = filterEdges[0].weight
  for (let i = 1; i < filterEdges.length; i++) {
    if (biggest < filterEdges[i].weight)
      biggest = filterEdges[i].weight
  }
  return biggest
}

export const delay = (ms: number) : Promise<any> => new Promise(resolve => setTimeout(resolve, ms))

export const extensionFromFilename = (filename: string): string | undefined => {
  const strArray = filename.split('.')
  // if filename has no extension
  if (strArray.length < 2) return undefined
  // else return extension
  return strArray.pop()
}

export const contentTypeFromExt = (ext: string): string | undefined => {
  switch(ext.toLowerCase()) {
  case 'jpg':
    return 'image/jpeg'
  case 'jpeg':
    return 'image/jpeg'
  case 'png':
    return 'image/png'
  case 'svg':
    return 'image/svg+xml'
  case 'gif':
    return 'image/gif'
  case 'webp':
    return 'image/webp'
  case 'avif':
    return 'image/avif'
  case 'mp4':
    return 'video/mp4'
  case 'bmp':
    return 'image/bmp'
  case 'tiff':
    return 'image/tiff'
  default:
    return undefined
  }
}

export const processIPFSURL = (image: string): string => {
  let prefix
  if (!process.env.IPFS_WEB_GATEWAY) {
    prefix = 'https://cloudflare-ipfs.com/ipfs/'
  } else {
    const prefixes = process.env.IPFS_WEB_GATEWAY.split(',')
    if (!prefixes.length) {
      prefix = 'https://cloudflare-ipfs.com/ipfs/'
    } else {
      // we pick prefix randomly to avoid dependency on just one gateway
      prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
      if (!prefix.startsWith('https://')) {
        prefix = 'https://cloudflare-ipfs.com/ipfs/'
      }
    }
  }

  if (image == null) {
    return null
  } else if (image.indexOf('ipfs://ipfs/') === 0) {
    return prefix + image.slice(12)
  } else if (image.indexOf('ipfs://') === 0) {
    return prefix + image.slice(7)
  } else if (image.indexOf('https://ipfs.io/ipfs/') === 0) {
    return prefix + image.slice(21)
  } else if (image.indexOf('https://ipfs.infura.io/ipfs/') === 0) {
    return prefix + image.slice(28)
  } else if (image.indexOf('https://infura-ipfs.io/ipfs/') === 0) {
    return prefix + image.slice(28)
  } else if (image.indexOf('pinata.cloud/ipfs/') !== -1) {
    const index = image.indexOf('pinata.cloud/ipfs/')
    return prefix + image.slice(index + 18)
  } else if (image.indexOf('ar://') === 0) {
    return 'https://arweave.net/' + image.slice(5)
  } else {
    return image
  }
}

export const fetchWithTimeout = async (
  resource: any,
  options: any,
): Promise<any> => {
  const { timeout = 8000 } = options
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  })
  clearTimeout(id)
  return response
}

export const generateSVGFromBase64String = (
  base64String: string,
): string => {
  return `<svg width="600" height="600"
  xmlns="http://www.w3.org/2000/svg">
  <image xmlns="http://www.w3.org/2000/svg" href="${base64String}" width="600" height="600"/>
</svg>`
}

export const profileActionType = (
  action: entity.IncentiveAction,
): gql.ProfileActionType => {
  if (action.task === ProfileTask.CREATE_NFT_PROFILE)
    return gql.ProfileActionType.CreateNFTProfile
  else if (action.task === ProfileTask.CUSTOMIZE_PROFILE)
    return gql.ProfileActionType.CustomizeProfile
  else if (action.task === ProfileTask.REFER_NETWORK)
    return gql.ProfileActionType.ReferNetwork
  else if (action.task === ProfileTask.BUY_NFTS)
    return gql.ProfileActionType.BuyNFTs
  else if (action.task === ProfileTask.LIST_NFTS)
    return gql.ProfileActionType.ListNFTs
  else if (action.task === ProfileTask.ISSUE_NFTS)
    return gql.ProfileActionType.IssueNFTs
}

const firstEntitiesAfter =
async <T>(entities: T[], pageInput: gql.PageInput, property: string): Promise<defs.PageableResult<T>> => {
  const index = entities.findIndex((e) => e[property] === pageInput.afterCursor) + 1
  return [
    entities.slice(index, index + pageInput.first),
    entities.length,
  ]
}

const firstEntitiesBefore =
async <T>(entities: T[], pageInput: gql.PageInput, property: string): Promise<defs.PageableResult<T>> => {
  return [
    entities.slice(0, Math.min(
      pageInput.first,
      entities.findIndex((e) => e[property] === pageInput.beforeCursor),
    )),
    entities.length,
  ]
}

const lastEntitiesAfter =
async <T>(entities: T[], pageInput: gql.PageInput, property: string): Promise<defs.PageableResult<T>> => {
  const index = entities.findIndex((e) => e[property]=== pageInput.afterCursor) + 1
  return [
    entities.slice(Math.max(index, entities.length - pageInput.last)),
    entities.length,
  ]
}

const lastEntitiesBefore =
async <T>(entities: T[], pageInput: gql.PageInput, property: string): Promise<defs.PageableResult<T>> => {
  const index = entities.findIndex((e) => e[property] === pageInput.beforeCursor)
  return [
    entities.slice(Math.max(0, index - pageInput.last), index),
    entities.length,
  ]
}

export const paginateEntityArray =
<T>(entities: T[], pageInput: gql.PageInput, cursorProp = 'id'): Promise<defs.PageableResult<T>> => {
  return pagination.resolvePage<T>(pageInput, {
    firstAfter: () => firstEntitiesAfter(entities, pageInput, cursorProp),
    firstBefore: () => firstEntitiesBefore(entities, pageInput, cursorProp),
    lastAfter: () => lastEntitiesAfter(entities, pageInput, cursorProp),
    lastBefore: () => lastEntitiesBefore(entities, pageInput, cursorProp),
  })
}

export type Call = {
  contract: string
  name: string
  params?: any[]
}

/**
 * Fetches information about pools and return as `Pair` array using multicall contract.
 * @param calls 'Call' array
 * @param abi
 * @param chainId
 * based on:
 * - https://github.com/mds1/multicall#deployments
 * - https://github.com/sushiswap/sushiswap-sdk/blob/canary/src/constants/addresses.ts#L323
 * - https://github.com/joshstevens19/ethereum-multicall#multicall-contracts
 */

export const fetchDataUsingMulticall = async (
  calls: Array<Call>,
  abi: any[],
  chainId: string,
): Promise<Array<Result | undefined>> => {
  try {
    // 1. create contract using multicall contract address and abi...
    const multicallAddress = process.env.MULTICALL_CONTRACT
    const multicallContract = new Contract(
      multicallAddress.toLowerCase(),
      Multicall2,
      provider.provider(Number(chainId)),
    )
    const abiInterface = new ethers.utils.Interface(abi)
    const callData = calls.map((call) => [
      call.contract.toLowerCase(),
      abiInterface.encodeFunctionData(call.name, call.params),
    ])
    // 2. get bytes array from multicall contract by process aggregate method...
    const results: { success: boolean; returnData: string }[] =
      await multicallContract.tryAggregate(false, callData)

    // 3. decode bytes array to useful data array...
    return results.map((result, i) => {
      if (result.returnData === '0x') {
        return undefined
      } else {
        return abiInterface.decodeFunctionResult(
          calls[i].name,
          result.returnData,
        )
      }
    })
  } catch (error) {
    logger.error(
      `Failed to fetch data using multicall: ${error}`,
    )
    return []
  }
}

export const sendEmailVerificationCode = async (
  email: string,
  user: entity.User,
  repositories: db.Repository,
): Promise<void> => {
  try {
    const updatedUser = await repositories.user.updateOneById(user.id, {
      email,
      confirmEmailToken: cryptoRandomString({ length: 36, type: 'url-safe' }),
      confirmEmailTokenExpiresAt: addDays(helper.toUTCDate(), 1),
    })
    await sendgrid.sendEmailVerificationCode(updatedUser)
  } catch (err) {
    logger.error(`Error in sendEmailVerificationCode: ${err}`)
  }
}

export const checkAddressIsSanctioned = async (
  address: string,
): Promise<boolean> => {
  try {
    const key = `OFAC_RESULT_${address}`
    const cachedData = await cache.get(key)
    if (cachedData) {
      const identification = JSON.parse(cachedData) as number
      return identification !== 0
    }
    const headers = {
      'X-API-Key': process.env.OFAC_API_KEY,
      'Accept': 'application/json',
    }
    const url = `https://public.chainalysis.com/api/v1/address/${address}`
    const res = await axios.get(url, { headers })
    if (res && res?.data && res?.data?.identifications) {
      await cache.set(key, JSON.stringify(res?.data?.identifications.length), 'EX', 60 * 60) // 1 hour
      return !!res?.data?.identifications.length
    } else {
      return true
    }
  } catch (err) {
    logger.error(`Error in checkAddressIsSanctioned: ${err}`)
    return true
  }
}
