const nxPreset = require('@nrwl/jest/preset').default

module.exports = { 
  ...nxPreset,
  coverageReporters: ['lcovonly', 'text'],
  collectCoverageFrom: [
    '**/*.{ts}',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
}
