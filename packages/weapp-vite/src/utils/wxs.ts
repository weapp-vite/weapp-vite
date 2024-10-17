import type { Plugin } from 'esbuild'
import type { TsupOptions } from '../types'
import { defu } from '@weapp-core/shared'
import { changeFileExtension } from './file'
// 重命名逻辑：将 .wxs.ts 重命名为 .wxs
function renameCallback(oldPath: string) {
  return changeFileExtension(oldPath, '.js') // 根据你的规则修改产物文件名
}

const RenamePlugin: Plugin = {
  name: 'rename-output-files',
  setup(build) {
    // build.onStart(() => {

    // })
    // build.onLoad({ filter: /.*/ }, async (args) => {
    //   return {
    //     contents: await fs.readFile(args.path),
    //     loader: 'js',
    //   }
    // })

    // build.onResolve({ filter: /.*/ }, (args) => {
    //   console.log(args)
    //   return {

    //   }
    // })
    // 使用 onEnd 钩子，在构建完成时执行
    build.onEnd((result) => {
      // 访问构建产物的文件路径
      if (result.outputFiles) {
        for (const output of result.outputFiles) {
          const oldPath = output.path
          const newPath = renameCallback(oldPath) // 通过回调函数获取新的文件名

          if (oldPath !== newPath) {
            output.path = newPath
          }
        }
      }
    })
  },
}

export async function buildWxs(options: TsupOptions & { outbase?: string }) {
  const { build: tsupBuild } = await import('tsup')
  // https://github.com/egoist/tsup/blob/db7a0225cdd5f782ae65c5abee11a24e1dc55a65/src/plugins/swc-target.ts#L3
  const mergedOptions: TsupOptions = defu<TsupOptions, TsupOptions[]>(options, {
    format: 'cjs',
    target: 'es2020',
    silent: true,
    shims: true,
    loader: {
      '.wxs': 'js',
    },

    esbuildOptions: (opts) => {
      opts.entryNames = '[dir]/[name]'
      opts.outExtension = {
        '.js': '.wxs',
      }
      opts.outbase = options.outbase
      // opts.minify = true
    },

    sourcemap: false,
    config: false,
    // https://github.com/egoist/tsup/blob/db7a0225cdd5f782ae65c5abee11a24e1dc55a65/src/esbuild/index.ts#L17
    // https://github.com/egoist/tsup/blob/db7a0225cdd5f782ae65c5abee11a24e1dc55a65/src/esbuild/swc.ts#L6
    esbuildPlugins: [RenamePlugin],
    plugins: [{
      name: 'wxs-support',
      buildStart() {
        console.log(this)
      },
      buildEnd(ctx) {
        console.log(this, ctx)
      },
      renderChunk(code, chunkInfo) {
        console.log(code, chunkInfo)
        chunkInfo.path = chunkInfo.path.replace(/(?:\.wxs)?.js$/, '.wxs')
        return {
          code,
        }
      },
    }],
  })
  await tsupBuild(mergedOptions)
}
