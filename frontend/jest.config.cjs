module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { configFile: require.resolve('./jest-babel.config.cjs') }] },
  clearMocks: true,
};
