export default {
  testEnvironment: 'node',
  preset: 'node',
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!((@flashbots|@uniswap)/.*|ethers)/)'
  ],
  testMatch: [
    '**/src/**/*.test.js'
  ],
  collectCoverage: false,
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/test/setup.js']
};