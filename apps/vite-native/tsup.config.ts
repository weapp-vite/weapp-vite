import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['pages/index/index.wxs.ts'],
  // entry: wxsPaths,
  format: ['cjs'],
  outDir: 'dist',
  target: 'es5',
  // silent: true,
  shims: true,
  loader: {
    '.wxs': 'js',
  },
  esbuildOptions: (options) => {
    // options.entryNames
    // options.outExtension
    options.entryNames = 'xx/[dir]/[name]'
  },
  // esbuildOptions: (options) => {
  //   // options.entryNames
  //   // options.outExtension
  // },
  // outExtension: ({ format, options }) => {
  //   // console.log(format)
  //   return {
  //     js: '.wxs', // .wxs',
  //   }
  // },
  config: false,
  sourcemap: false,
})
