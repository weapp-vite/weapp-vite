import path from 'node:path'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  // entries: ['./src/index', './src/cli'],
  rollup: {
    // 内联，相当于 nodeResolve
    inlineDependencies: true,
    // cjs
    emitCJS: false,
    // 添加 cjs 注入
    cjsBridge: false,
    dts: {
      // https://github.com/unjs/unbuild/issues/135
      respectExternal: false,
    },
  },
  alias: {
    // 别名
    '@': path.resolve(__dirname, './src'),
  },
  // dts
  declaration: true,
})
