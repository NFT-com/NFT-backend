import Joi from 'joi'

import { Context, gql } from '@nftcom/gql/defs'
import { joi } from '@nftcom/gql/helper'
import { fetchData, getSalesData } from '@nftcom/gql/service/contractData.service'

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

  return await fetchData('nfts', [contractAddress, tokenId], {
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

  return await fetchData('stats', [contractAddress])
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

  return await fetchData('txByContract', [contractAddress], {}, queryParams)
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

  return await fetchData('txByNFT', [contractAddress, tokenId], {}, queryParams)
}

export const getSales = async (_: any, args: gql.QueryGetSalesArgs, _ctx: any): Promise<any> => {
  const schema = Joi.object().keys({
    contractAddress: Joi.string().required(),
    dateRange: Joi.string().valid('24h', '7d', '30d', '90d', '6m', '1y', 'all').optional(),
    tokenId: Joi.string().optional(),
  })
  joi.validateSchema(schema, args.input)
  const { contractAddress, dateRange, tokenId } = args.input
  
  return await getSalesData(contractAddress, dateRange, tokenId)
}

export default {
  Query: {
    getNFTDetails,
    getContractSalesStatistics,
    getTxByContract,
    getTxByNFT,
    getSales,
  },
}
