import { BigNumber,ethers } from 'ethers'
import Joi from 'joi'
import { isEmpty } from 'lodash'

import { appError } from '@src/graphql/error'

export const validateSchema = (schema: Joi.ObjectSchema, input: unknown): void => {
  const { error } = schema.validate(input, { abortEarly: false })
  if (error) {
    throw appError.buildInvalidSchema(error)
  }
}

export const buildWalletInputSchema = (): Joi.ObjectSchema =>
  Joi.object().keys({
    address: Joi.string().required()
      .custom((value: string, helpers) => {
        const address = ethers.utils.getAddress(value)
        if (isEmpty(address)) {
          return helpers.error('invalid address')
        }
        return address
      }),
    chainId: Joi.string().required(),
    network: Joi.string().required(),
  })

export const buildSignatureInputSchema = (): Joi.ObjectSchema =>
  Joi.object().keys({
    v: Joi.number().required(),
    r: Joi.binary().required(),
    s: Joi.binary().required(),
  })

export const buildBigNumber = (value: string, helpers): number => {
  const v = BigNumber.from(value)
  if (isEmpty(v) || v.lte(BigNumber.from(0))) {
    return helpers.error('invalid price/amount')
  }
  return Number(v._hex)
}
