/* eslint-disable */
require('dotenv').config()
if (!process.env.TEAM_AUTH_TOKEN) {
  require('child_process').execSync('doppler run -- printenv').toString().split('\n').reduce((acc: any, envStr: string) => {
    const name = envStr.split('=')[0]
    acc[name] = envStr.substring(name.length + 1)
    return acc
  }, process.env)
}

export default {
  displayName: 'gql',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(unit).(spec|test).[jt]s?(x)'],
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../coverage/packages/gql',
  testTimeout: 20000,
  moduleNameMapper: {
    '@nftcom/shared/(.*)': '<rootDir>/../shared/src/$1',
    '@nftcom/gql/(.*)': '<rootDir>/src/$1',
  }
};
