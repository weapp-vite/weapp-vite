import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 文档单测只读取 fixture 常量，不依赖小程序应用生成的 tsconfig references。
  oxc: {
    tsconfig: false,
  },
  test: {
    name: 'website',
    include: ['.vitepress/**/*.test.ts'],
  },
})
