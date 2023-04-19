import { NextFunction, Request, Response } from 'express'
import { AnyZodObject, z } from 'zod'

export const emailSchema = z.object({
  params: z.object({
    email: z.string().email({ message: 'Invalid email address' }),
  }),
})

export const verifySchema = z.object({
  params: z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    token: z.string(),
  }),
})

export const validate = (schema: AnyZodObject) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    })
    return next()
  } catch (error) {
    return res.status(400).json(error)
  }
}
