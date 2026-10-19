import { defineConfig } from 'vitest/config'
import { localReporters } from './verificationBenchmark/localReporterConfig.mjs'

export default defineConfig({
  // 工具契约只需剥离类型，不能要求无关 app 先生成受管 tsconfig。
  oxc: { tsconfig: false },
  test: {
    reporters: localReporters(),
    environment: 'node',
    include: ['scripts/**/*.test.mjs', 'scripts/**/*.test.ts'],
  },
})
