import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts', './src/node.ts', './src/fs/index.ts', './src/platforms/index.ts', './src/platforms/runtime/index.ts'],
  // 本包源码使用 ESM；关闭 Node shim，避免污染浏览器与小程序入口。
  shims: false,
  format: ['esm'],
  clean: true,
  dts: true,
  // 保留静态平台描述与通用注册表的模块边界，供应用二次打包裁剪。
  unbundle: true,
  deps: {
    onlyBundle: false,
    resolveDepSubpath: true,
  },
  outExtensions() {
    return {
      js: '.js',
    }
  },
  target: 'node20',
  failOnWarn: false,
})
