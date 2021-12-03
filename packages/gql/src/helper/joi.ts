import { BigNumber } from 'ethers'
import Joi from 'joi'
import { isEmpty } from 'lodash'

import { appError } from '@nftcom/gql/error'

export const validateSchema = (schema: Joi.ObjectSchema, input: unknown): void => {
  const { error } = schema.validate(input, { abortEarly: false })
  if (error) {
    throw appError.buildInvalidSchema(error)
  }
}

export const buildWalletInputSchema = (): Joi.ObjectSchema =>
  Joi.object().keys({
    address: Joi.string().required(),
    chainId: Joi.string().required(),
    network: Joi.string().required(),
  })

export const buildSignatureInputSchema = (): Joi.ObjectSchema =>
  Joi.object().keys({
    v: Joi.number().required(),
    r: Joi.binary().required(),
    s: Joi.binary().required(),
  })

export const buildBigNumber = (value: string, helpers): string => {
  const v = BigNumber.from(value)
  if (isEmpty(v) || v.lte(BigNumber.from(0))) {
    return helpers.error('invalid price/amount')
  }
  return v._hex
}
