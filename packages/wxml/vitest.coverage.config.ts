import type { OxcOptions } from 'vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defaultCorpusReports } from '../../scripts/templateCorpus/paths'

// 跨目录源码验收不加载 workspace 应用的受管 TypeScript 配置。
const sourceCoverageTransform: OxcOptions & { tsconfig: false } = { tsconfig: false }

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  oxc: sourceCoverageTransform,
  test: {
    globals: true,
    include: ['src/**/*.test.ts', '../../scripts/templateCorpus/test/sourceCoverage.coverage.ts'],
    testTimeout: 120_000,
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.d.ts'],
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: `${defaultCorpusReports}/coverage`,
      thresholds: { statements: 100, functions: 100, lines: 100, branches: 99 },
    },
  },
})
