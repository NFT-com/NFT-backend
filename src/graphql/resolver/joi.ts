import Joi from 'joi'

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
