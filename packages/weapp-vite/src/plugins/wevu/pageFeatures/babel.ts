import type * as t from '@babel/types'
import generateModule from '@babel/generator'
import { parse as babelParse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import { BABEL_TS_MODULE_PLUGINS } from '../../../utils/babel'

export const traverse: typeof traverseModule = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule
export const generate: typeof generateModule = (generateModule as any).default ?? generateModule

export function parseJsLike(source: string): t.File {
  return babelParse(source, {
    sourceType: 'module',
    plugins: [
      ...BABEL_TS_MODULE_PLUGINS,
      'dynamicImport',
      'optionalChaining',
      'nullishCoalescingOperator',
    ],
  }) as unknown as t.File
}
