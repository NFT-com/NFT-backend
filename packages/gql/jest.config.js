if (process.env.VS_CODE === '1') {
  require('child_process').execSync('doppler run -- printenv').toString().split('\n').reduce((acc, envStr) => {
    const name = envStr.split('=')[0];
    acc[name] = envStr.substring(name.length + 1);
    return acc;
  }, process.env);
}

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 20000,
  moduleNameMapper: {
    '@nftcom/shared/(.*)': '<rootDir>/../shared/src/$1',
    '@nftcom/gql/(.*)': '<rootDir>/src/$1',
  },
}