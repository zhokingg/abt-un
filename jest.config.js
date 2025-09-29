export default {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!((@flashbots|@uniswap)/.*|ethers)/)'
  ],
  testMatch: [
    '**/src/**/*.test.js',
    '**/tests/**/*.test.js'
  ],
  collectCoverage: false,
  verbose: true
};