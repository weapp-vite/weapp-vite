import { defineConfig } from 'vitest/config'
import { SCRIPT_TEST_GLOBS } from './verification/toolTests.ts'
import { localReporters, localTestPolicy } from './verificationBenchmark/localReporterConfig.mjs'

export default defineConfig({
  // 工具契约只需剥离类型，不能要求无关 app 先生成受管 tsconfig。
  oxc: { tsconfig: false },
  plugins: [{
    name: 'scripts:published-node-conditions',
    config: {
      order: 'post',
      handler(config) {
        // 覆盖 Vitest 合并后的默认条件，按原生 Node 加载发布产物。
        config.environments.ssr.resolve.conditions = ['node']
      },
    },
  }],
  test: {
    reporters: localReporters(),
    ...localTestPolicy(),
    environment: 'node',
    include: SCRIPT_TEST_GLOBS,
  },
})
