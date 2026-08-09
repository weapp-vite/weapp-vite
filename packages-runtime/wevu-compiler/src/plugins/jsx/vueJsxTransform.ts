import type { TransformResult } from '@babel/core'
import { createRequire } from 'node:module'
import { transformSync } from '@weapp-vite/ast/babelCore'

const require = createRequire(import.meta.url)

export function transformVueJsxScript(source: string, filename: string, sourceMaps = true) {
  const plugin = require('@vue/babel-plugin-jsx')
  const result = transformSync(source, {
    filename,
    sourceType: 'module',
    sourceMaps,
    plugins: [[plugin, { optimize: true }]],
    parserOpts: {
      plugins: ['typescript', 'jsx'],
    },
    generatorOpts: {
      retainLines: !sourceMaps,
    },
  }) as TransformResult | null

  return {
    code: result?.code ?? source,
    map: result?.map ?? null,
  }
}
