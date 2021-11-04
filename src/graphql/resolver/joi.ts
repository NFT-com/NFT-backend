import Joi from 'joi'

import { appError } from '@src/graphql/error'

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
