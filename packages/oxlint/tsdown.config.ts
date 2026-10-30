import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts', './src/plugin.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  deps: {
    resolveDepSubpath: true,
    // ESLint 的命名空间由其公开声明维护，避免打平后生成递归类型别名。
    dts: { neverBundle: ['eslint'] },
  },
  target: 'node20',
})
