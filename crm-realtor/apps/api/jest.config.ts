import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Лёгкие unit-тесты бизнес-логики с замоканным Prisma — без реальной БД,
  // чтобы прогон был детерминированным и работал в CI.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true } }],
  },
};

export default config;
