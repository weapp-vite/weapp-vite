import type { Plugin } from 'esbuild'
import type { TsupOptions } from '../types'
import swc from '@swc/core'
import { defu } from '@weapp-core/shared'
import { changeFileExtension } from './file'
// 重命名逻辑：将 .wxs.ts 重命名为 .wxs
function renameCallback(oldPath: string) {
  return changeFileExtension(oldPath, '.js') // 根据你的规则修改产物文件名
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

// https://developers.weixin.qq.com/community/develop/doc/000ece286546c0db98a7e74a951800
export async function buildWxs(options: TsupOptions & { outbase?: string }) {
  const { build: tsupBuild } = await import('tsup')
  // https://github.com/egoist/tsup/blob/db7a0225cdd5f782ae65c5abee11a24e1dc55a65/src/plugins/swc-target.ts#L3
  const mergedOptions: TsupOptions = defu<TsupOptions, TsupOptions[]>(options, {
    format: 'cjs',
    target: 'es2023',
    silent: true,
    // shims: true,
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
    // treeshake: true,
    sourcemap: false,
    config: false,
    // https://github.com/egoist/tsup/blob/db7a0225cdd5f782ae65c5abee11a24e1dc55a65/src/esbuild/index.ts#L17
    // https://github.com/egoist/tsup/blob/db7a0225cdd5f782ae65c5abee11a24e1dc55a65/src/esbuild/swc.ts#L6
    esbuildPlugins: [RenamePlugin],
    plugins: [{
      name: 'wxs-support',
      async renderChunk(code, chunkInfo) {
        chunkInfo.path = chunkInfo.path.replace(/(?:\.wxs)?.js$/, '.wxs')
        // for(var name in all) error
        const result = await swc.transform(code, {
          filename: chunkInfo.path,
          sourceMaps: this.options.sourcemap,
          minify: Boolean(this.options.minify),
          jsc: {
            // target: 'es5',
            parser: {
              syntax: 'ecmascript',
            },
            minify:
              this.options.minify === true
                ? {
                    compress: false,
                    mangle: {
                      reserved: this.options.globalName
                        ? [this.options.globalName]
                        : [],
                    },
                  }
                : undefined,
            // 宽松模式
            loose: false,
            externalHelpers: false,
          },
          module: {
            type: 'commonjs', // this.format === 'cjs' ? 'commonjs' : 'es6',
            // noInterop: true,
            // strict: true,
          },
          env: {
            include: [
              'transform-arrow-functions',
              'transform-async-to-generator',
              'transform-regenerator',
            ],

          },
        })
        return {
          code: result.code,
          map: result.map,
        }
      },
    }],
  })
  await tsupBuild(mergedOptions)
}
