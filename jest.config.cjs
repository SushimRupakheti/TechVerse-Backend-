/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  transformIgnorePatterns: ['/node_modules/'],
  clearMocks: true,
};

module.exports = {
  projects: [
    {
      ...base,
      displayName: 'unit',
      testMatch: ['**/__tests__/unit/**/*.test.ts'],
    },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['**/__tests__/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setupTests.ts'],
      testPathIgnorePatterns: ['<rootDir>/src/__tests__/setupTests.ts'],
    },
  ],
};
