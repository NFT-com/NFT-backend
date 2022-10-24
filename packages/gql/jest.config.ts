/* eslint-disable */
export default {
  displayName: 'gql',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        isolatedModules: true,
      },
    ]
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../coverage/packages/gql',
  testTimeout: 20000,
  moduleNameMapper: {
    '@nftcom/shared/(.*)': '<rootDir>/../shared/src/$1',
    '@nftcom/gql/(.*)': '<rootDir>/src/$1',
  }
};
