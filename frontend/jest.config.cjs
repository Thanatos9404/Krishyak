module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  clearMocks: true,
};
