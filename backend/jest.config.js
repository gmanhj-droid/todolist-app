export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  coverageProvider: 'v8',
  collectCoverageFrom: ['src/**/*.js'],
  coverageThreshold: { global: { lines: 80 } },
};
