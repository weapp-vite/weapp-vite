import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  // 仅压缩空白，保留函数名与控制流，降低分发和冷启动成本。
  minify: {
    compress: false,
    mangle: false,
    codegen: {
      removeWhitespace: true,
      legalComments: 'none',
    },
  },
  failOnWarn: false,
})
