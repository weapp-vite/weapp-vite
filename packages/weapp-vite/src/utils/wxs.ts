import type { TsupOptions } from '../types'
import { defu } from '@weapp-core/shared'
// import { build } from 'vite'

export async function buildWxs(options: TsupOptions) {
  // build({
  //   build:{
  //     target:
  //   }
  // })
  const { build: tsupBuild } = await import('tsup')
  // build({})
  const mergedOptions: TsupOptions = defu<TsupOptions, TsupOptions[]>(options, {
    // entry: wxsPaths,
    format: ['cjs'],
    // outDir: ctx.outDir,
    target: 'es5',
    // silent: true,
    shims: true,
    loader: {
      '.wxs': 'js',
    },
    esbuildOptions: (options) => {
      // options.entryNames
      // options.outExtension
      options.entryNames = '[dir]/[name]'
      options.outExtension = {
        '.js': '.wxs',
      }
    },
    // outExtension: ({ format, options }) => {
    //   // console.log(format)
    //   return {
    //     js: '.wxs', // .wxs',
    //   }
    // },
    config: false,
    sourcemap: false,
  })
  await tsupBuild(mergedOptions)
}
