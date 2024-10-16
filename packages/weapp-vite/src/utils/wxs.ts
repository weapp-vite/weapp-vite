import type { Plugin } from 'esbuild'
import type { TsupOptions } from '../types'
import { defu } from '@weapp-core/shared'

// 重命名逻辑：将 .wxs.ts 重命名为 .wxs
function renameCallback(oldPath: string) {
  return oldPath.replace('.wxs.wxs', '.wxs') // 根据你的规则修改产物文件名
}

const RenamePlugin: Plugin = {
  name: 'rename-output-files',
  setup(build) {
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

  const mergedOptions: TsupOptions = defu<TsupOptions, TsupOptions[]>(options, {
    format: 'cjs',
    target: 'es5',
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
    esbuildPlugins: [RenamePlugin],
  })
  await tsupBuild(mergedOptions)
}
