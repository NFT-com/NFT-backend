import axios from 'axios'
import Joi from 'joi'
import { stringify } from 'qs'
import { format } from 'util'

import { Context, gql } from '@nftcom/gql/defs'
import { appError } from '@nftcom/gql/error'
import { joi } from '@nftcom/gql/helper'
import { cache } from '@nftcom/gql/service/cache.service'
import { _logger } from '@nftcom/shared'

const NFTPORT_KEY = process.env.NFTPORT_KEY || ''

const NFTPORT_ENDPOINTS = {
  nfts: 'https://api.nftport.xyz/v0/nfts/%s/%s',
  stats: 'https://api.nftport.xyz/v0/transactions/stats/%s',
  txByContract: 'https://api.nftport.xyz/v0/transactions/nfts/%s',
  txByNFT: 'https://api.nftport.xyz/v0/transactions/nfts/%s/%s',
}

const logger = _logger.Factory('ContractDataResolver', _logger.Context.GraphQL)

const sendRequest = async (url: string, extraHeaders = {}, queryParams = {}): Promise<any> => {
  try {
    return await axios.get(url, {
      params: {
        chain: 'ethereum',
        ...queryParams,
      },
      paramsSerializer: function(params) {
        return stringify(params, { arrayFormat: 'repeat' })
      },
      headers: {
        Authorization: NFTPORT_KEY,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
    })
  } catch (error) {
    if (error.response) {
      logger.error(
        {
          data: error.response.data,
          status: error.response.status,
          headers: error.response.headers,
          params: error.response.config.params,
          url: `${error.response.config.url}${error.response.request.path}`,
        },
        `Request failed to ${url}`,
      )
    } else if (error.request) {
      logger.error(error.request, `Request failed to ${url}`)
    } else {
      logger.error(`Error: ${error.message}`, `Request failed to ${url}`)
    }
    throw appError.buildInternal()
  }
}

const fetchData = async (
  endpoint: string, key: string, args: string[],
  extraHeaders = {}, queryParams = {},
): Promise<any> => {
  const cachedData = await cache.get(key)
  if (cachedData) {
    return JSON.parse(cachedData)
  }
  const url = format(NFTPORT_ENDPOINTS[endpoint], ...args)
  const { data } = await sendRequest(url, extraHeaders, queryParams)
  if (data.response === 'OK') {
    await cache.set(
      key,
      JSON.stringify(data),
      'EX',
      60 * 60, // 60 minutes
    )
  } else {
    logger.error(data, `Unsuccessful response from ${url}`)
  }

  return data
}

export const getNFTDetails = async (
  _: any,
  args: gql.QueryGetNFTDetailsArgs,
  _ctx: Context,
): Promise<gql.NFTDetail> => {
  const schema = Joi.object().keys({
    contractAddress: Joi.string().required(),
    tokenId: Joi.string().required(),
    refreshMetadata: Joi.boolean().optional(),
  })
  joi.validateSchema(schema, args.input)
  const { contractAddress, tokenId, refreshMetadata } = args.input

  const key = `nft_details_${contractAddress}_${tokenId}`
  return await fetchData('nfts', key, [contractAddress, tokenId], {
    refresh_metadata: !!refreshMetadata,
  })
}

export const getContractSalesStatistics = async (
  _: any,
  args: gql.QueryGetContractSalesStatisticsArgs,
  _ctx: Context,
): Promise<gql.ContractSalesStatistics> => {
  const schema = Joi.object().keys({
    contractAddress: Joi.string().required(),
  })
  joi.validateSchema(schema, args.input)
  const { contractAddress } = args.input

  const key = `contract_sales_stats_${contractAddress}`
  return await fetchData('stats', key, [contractAddress])
}

export const getTxByContract = async (
  _: any,
  args: gql.QueryGetTxByContractArgs,
  _ctx: Context,
): Promise<gql.NFTPortTxByContract> => {
  const schema = Joi.object().keys({
    contractAddress: Joi.string().required(),
    chain: Joi.string().valid('ethereum').optional(),
    type: Joi.array().items(Joi.string().valid('transfer', 'burn', 'mint', 'sale', 'all')).optional(),
    continuation: Joi.string().optional(),
    pageSize: Joi.number().integer().min(1).max(50).optional(),
  })
  joi.validateSchema(schema, args.input)
  const { contractAddress, chain, type, continuation, pageSize } = args.input
  const queryParams = {
    chain: chain || 'ethereum',
    type: type || 'all',
    continuation,
    page_size: pageSize,
  }

  const key = `tx_by_contract_${contractAddress}_${continuation||''}_${pageSize||''}`
  return await fetchData('txByContract', key, [contractAddress], {}, queryParams)
}

export const getTxByNFT = async (
  _: any,
  args: gql.QueryGetTxByNFTArgs,
  _ctx: Context,
): Promise<gql.NFTPortTxByContract> => {
  const schema = Joi.object().keys({
    contractAddress: Joi.string().required(),
    tokenId: Joi.string().required(),
    chain: Joi.string().valid('ethereum').optional(),
    type: Joi.array().items(Joi.string().valid('transfer', 'burn', 'mint', 'sale', 'all')).optional(),
    continuation: Joi.string().optional(),
    pageSize: Joi.number().integer().min(1).max(50).optional(),
  })
  joi.validateSchema(schema, args.input)
  const { contractAddress, tokenId, chain, type, continuation, pageSize } = args.input
  const queryParams = {
    chain: chain || 'ethereum',
    type: type || 'all',
    continuation,
    page_size: pageSize,
  }

  const key = `tx_by_nft_${contractAddress}_${tokenId}_${continuation||''}_${pageSize||''}`
  return await fetchData('txByNFT', key, [contractAddress, tokenId], {}, queryParams)
}

export default {
  Query: {
    getNFTDetails,
    getContractSalesStatistics,
    getTxByContract,
    getTxByNFT,
  },
}
