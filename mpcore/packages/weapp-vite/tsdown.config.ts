import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    test: './src/test.ts',
    e2e: './src/e2e.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  deps: {
    resolveDepSubpath: true,
    neverBundle: ['weapp-vite/test', 'weapp-vite/e2e'],
    dts: {
      // 子路径只转发 weapp-vite 的公开声明，避免重复打包 simulator 类型。
      neverBundle: ['weapp-vite/test', 'weapp-vite/e2e'],
    },
  },
  target: 'node20',
  failOnWarn: false,
})
