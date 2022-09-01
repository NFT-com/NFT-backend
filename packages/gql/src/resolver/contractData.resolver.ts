import axios from 'axios'
import Joi from 'joi'
import { format } from 'util'

import { Context, gql } from '@nftcom/gql/defs'
import { appError } from '@nftcom/gql/error'
import { joi } from '@nftcom/gql/helper'
import { cache } from '@nftcom/gql/service/cache.service'
import { _logger } from '@nftcom/shared'
import { LoggerContext } from '@nftcom/shared/helper/logger/types'

const NFTPORT_KEY = process.env.NFTPORT_KEY || ''

const NFTPORT_ENDPOINTS = {
  nfts: 'https://api.nftport.xyz/v0/nfts/%s/%s',
  stats: 'https://api.nftport.xyz/v0/transactions/stats/%s',
}

const logger = _logger.Factory('ContractDataResolver', LoggerContext.GraphQL)

const sendRequest = async (url: string, extraHeaders={}): Promise<any> => {
  try {
    return await axios.get(url, {
      params: {
        chain: 'ethereum',
      },
      headers: {
        Authorization: NFTPORT_KEY,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
    })
  } catch (error) {
    if (error.response) {
      logger.error({
        data: error.response.data,
        status: error.response.status,
        headers: error.response.headers,
      }, `Request failed to ${url}`)
    } else if (error.request) {
      logger.error(error.request, `Request failed to ${url}`)
    } else {
      logger.error(`Error: ${error.message}`, `Request failed to ${url}`)
    }
    throw appError.buildInternal()
  }
}

const fetchData =
  async (endpoint: string, key: string, args: string[], extraHeaders={}): Promise<any> => {
    const cachedData = await cache.get(key)
    if (cachedData) {
      return JSON.parse(cachedData)
    }
    const url = format(NFTPORT_ENDPOINTS[endpoint], ...args)
    const { data } = await sendRequest(url, extraHeaders)
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

const getNFTDetails =
  async (_: any,  args: any, _ctx: Context): Promise<gql.NFTDetail> => {
    const schema = Joi.object().keys({
      contractAddress: Joi.string().required(),
      tokenId: Joi.string().required(),
      refreshMetadata: Joi.boolean().optional(),
    })
    joi.validateSchema(schema, args.input)
    const { contractAddress, tokenId, refreshMetadata } = args.input

    const key = `nft_details_${contractAddress}_${tokenId}`
    return await fetchData(
      'nfts', key, [contractAddress, tokenId], { refresh_metadata: !!refreshMetadata })
  }

const getContractSalesStatistics =
  async (_: any, args: any, _ctx: Context): Promise<gql.ContractSalesStatistics> => {
    const schema = Joi.object().keys({
      contractAddress: Joi.string().required(),
    })
    joi.validateSchema(schema, args.input)
    const { contractAddress } = args.input

    const key = `contract_sales_stats_${contractAddress}`
    return await fetchData('stats', key, [contractAddress])
  }

export default {
  Query: {
    getNFTDetails,
    getContractSalesStatistics,
  },
}