import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 新 checkout 在测试内生成受管配置，加载测试时不读取尚未生成的引用。
  oxc: { tsconfig: false },
  test: { include: ['test/**/*.test.ts'] },
})
