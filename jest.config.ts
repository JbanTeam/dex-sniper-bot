import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

const config = {
  preset: 'ts-jest',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/../' }),
  setupFiles: ['dotenv/config'],
};

export default {
  projects: [
    {
      displayName: 'Unit',
      rootDir: 'src',
      testMatch: ['<rootDir>/modules/**/tests/**/*.test.ts'],
      coverageDirectory: './coverage',
      ...config,
    },
    {
      displayName: 'E2E',
      rootDir: 'tests',
      testMatch: ['<rootDir>/**/*.e2e.test.ts'],
      coverageDirectory: './coverage',
      ...config,
      // setupFilesAfterEnv: ['<rootDir>/test/setup-e2e.ts'], // Дополнительная настройка
      // globalSetup: '<rootDir>/test/global-setup.ts', // Глобальная настройка перед всеми тестами
      // globalTeardown: '<rootDir>/test/global-teardown.ts', // Глобальная очистка после всех тестов
    },
  ],
};
