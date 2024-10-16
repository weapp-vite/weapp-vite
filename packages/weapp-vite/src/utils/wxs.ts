import type { BuildOptions } from 'esbuild'
// import type { TsupOptions } from '../types'
import { defu } from '@weapp-core/shared'
import { build as esbuild } from 'esbuild'
// import { build } from 'vite'
// import { build } from 'vite'

export async function buildWxs(options: BuildOptions) {
  // build({
  //   build:{
  //     target:
  //   }
  // })
  // const { build: tsupBuild } = await import('tsup')
  // build({})
  const mergedOptions: BuildOptions = defu<BuildOptions, BuildOptions[]>(options, {
    // entry: wxsPaths,
    format: 'cjs',
    // outDir: ctx.outDir,
    target: 'es5',
    // silent: true,
    // shims: true,
    loader: {
      '.wxs': 'js',
    },
    entryNames: '[dir]/[name]',
    outExtension: {
      '.js': '.wxs',
    },
    sourcemap: false,
    // outbase: 'src',
    // esbuildOptions: (options) => {
    //   // options.entryNames
    //   // options.outExtension
    //   options.entryNames = '[dir]/[dir]/[name]'
    //   options.outExtension = {
    //     '.js': '.wxs',
    //   }
    //   options.assetNames = '[dir]/[name]'
    //   options.chunkNames = '[dir]/[name]'
    //   // 保持名称
    //   // options.keepNames = true
    // },
    // outExtension: ({ format, options }) => {
    //   // console.log(format)
    //   return {
    //     js: '.wxs', // .wxs',
    //   }
    // },
    // config: false,

  })
  await esbuild(mergedOptions)
}
