require('dotenv').config();
if (!process.env.TEAM_AUTH_TOKEN) {
  require('child_process').execSync('doppler run -- printenv').toString().split('\n').reduce((acc, envStr) => {
    const name = envStr.split('=')[0];
    acc[name] = envStr.substring(name.length + 1);
    return acc;
  }, process.env);
}

module.exports = {
  displayName: 'gql',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testTimeout: 20000,
  moduleNameMapper: {
    '@nftcom/shared/(.*)': '<rootDir>/../shared/src/$1',
    '@nftcom/gql/(.*)': '<rootDir>/src/$1',
  },
  coveragePathIgnorePatterns: [
    'src/tracer.ts'
  ],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    }
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  transformIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/../../node_modules/'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.base64.ts',
    '!**/node_modules/**'
  ]
}
