import type * as t from '@weapp-vite/ast/babelTypes'
import { createRequire } from 'node:module'
import * as babel from '@weapp-vite/ast/babelCore'
import { collectWxsDependencies } from './dependencies'

const nodeRequire = createRequire(import.meta.url)
type BabelPresetItem = NonNullable<babel.TransformOptions['presets']>[number]
type BabelPluginItem = NonNullable<babel.TransformOptions['plugins']>[number]

/** Filter 保留 JavaScript 模块语义，只擦除类型并归一化本地脚本后缀。 */
export function transformFilterCode(source: string, filename: string) {
  const loaded = nodeRequire('@babel/preset-typescript') as BabelPresetItem & { default?: BabelPresetItem }
  const importees: Array<{ source: string }> = []
  const result = babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    presets: [loaded.default ?? loaded],
    plugins: [{
      visitor: {
        Program(path: babel.NodePath<t.Program>) {
          importees.push(...collectWxsDependencies(path))
        },
        'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration': (path: babel.NodePath<t.ImportDeclaration | t.ExportNamedDeclaration | t.ExportAllDeclaration>) => {
          if (path.node.source?.value.startsWith('.')) {
            path.node.source.value = path.node.source.value.replace(/\.[jt]s$/, '.js')
          }
        },
      },
    } as unknown as BabelPluginItem],
  })
  return { result, code: result?.code, importees }
}
