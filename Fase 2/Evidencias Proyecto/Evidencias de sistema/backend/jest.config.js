/** Dos proyectos: "unit" (sin base de datos) y "e2e" (PostgreSQL real, servicios externos simulados). */
const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: { ignoreCodes: [151001] } }] },
};
// Los archivos e2e comparten una sola base de datos de pruebas, así que se ejecutan de a uno.
module.exports = {
  testTimeout: 30000,
  maxWorkers: 1,
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/test/unit/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
      globalSetup: '<rootDir>/test/soporte/global-setup.ts',
    },
  ],
};
