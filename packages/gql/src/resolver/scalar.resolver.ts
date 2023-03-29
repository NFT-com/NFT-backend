import { BigNumber, utils } from 'ethers'
import { GraphQLScalarType, GraphQLScalarTypeConfig, Kind } from 'graphql'
import { DateResolver, DateTimeResolver } from 'graphql-scalars'

import { appError } from '@nftcom/error-types'
import { helper } from '@nftcom/shared'

const invalidAddressError = appError.buildInvalid('Value is not an address', 'INVALID_ADDRESS')

const validateAddress = (value: string): string => {
  if (value.startsWith('0x') && value.length === 42) {
    return utils.getAddress(value)
  }
  throw invalidAddressError
}

const Address = new GraphQLScalarType({
  name: 'Address',
  description: 'Equivalent to solidity\'s address type',
  serialize: validateAddress,
  parseValue: validateAddress,
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      return invalidAddressError
    }
    return validateAddress(ast.value)
  },
})

const invalidBytesError = appError.buildInvalid('Value is not Bytes', 'INVALID_BYTES')

const validateBytes = (value: string): string => {
  if (value.startsWith('0x')) {
    return value
  }
  throw invalidBytesError
}

const Bytes = new GraphQLScalarType({
  name: 'Bytes',
  description: 'Equivalent to solidity\'s bytes type',
  serialize: validateBytes,
  parseValue: validateBytes,
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      return invalidBytesError
    }
    return validateBytes(ast.value)
  },
})

const invalidUint256Error = appError.buildInvalid('Value is not Uint256', 'INVALID_UINT256')

const Uint256 = new GraphQLScalarType({
  name: 'Uint256',
  description: 'Equivalent to solidity\'s uint256 type',
  serialize: value => value.toString(),
  parseValue: value => helper.bigNumber(value),
  parseLiteral(ast) {
    if (ast.kind !== Kind.INT && ast.kind !== Kind.STRING) {
      return invalidUint256Error
    }
    return helper.bigNumber(ast.value)
  },
} as GraphQLScalarTypeConfig<BigNumber, string>)

export default {
  Address,
  Bytes,
  Date: DateResolver,
  DateTime: DateTimeResolver,
  Uint256,
}
