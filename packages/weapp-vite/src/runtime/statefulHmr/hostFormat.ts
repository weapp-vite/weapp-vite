import type { Plugin } from 'rolldown'
import transformModulesCommonjs from '@babel/plugin-transform-modules-commonjs'
import { transformAsync } from '@weapp-vite/ast/babelCore'

/** 引擎以 ESM 生成原生依赖图，宿主仍在 bundler 写出前接收 CommonJS 模块。 */
export function createStatefulHmrHostFormatPlugin(): Pick<Plugin, 'name' | 'renderChunk'> {
  return {
    name: 'weapp-vite:stateful-host-format',
    renderChunk: {
      order: 'post',
      async handler(code, chunk, options) {
        const result = await transformAsync(code, {
          babelrc: false,
          configFile: false,
          filename: chunk.fileName,
          sourceFileName: chunk.fileName,
          sourceType: 'module',
          sourceMaps: Boolean(options.sourcemap),
          plugins: [transformModulesCommonjs],
        })
        if (!result?.code) {
          throw new Error('[weapp-vite] stateful 宿主模块格式转换未返回代码。')
        }
        return { code: result.code, map: result.map ? JSON.stringify(result.map) : null }
      },
    },
  }
}
