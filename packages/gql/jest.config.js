module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 20000,
  moduleNameMapper: {
    '@nftcom/shared/(.*)': '<rootDir>/../shared/src/$1',
    '@nftcom/gql/(.*)': '<rootDir>/src/$1',
  },
}