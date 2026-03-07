import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/compiler',
    './src/jsx-runtime',
    './src/store',
    './src/api',
    './src/fetch',
    './src/router',
  ],
  format: ['esm'],
  target: 'es2018',
  dts: true,
  // dts: {
  //   compilerOptions: {
  //     declarationMap: true,
  //   },
  //   sourcemap: true,
  // },
  clean: true,
  // minify: true,
  sourcemap: false,
  failOnWarn: false,
})
