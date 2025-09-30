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
    '**/tests/**/*.test.js',
    '**/test/**/*.test.js'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/tests/',
    '\\.test\\.js$'
  ],
  verbose: true
};