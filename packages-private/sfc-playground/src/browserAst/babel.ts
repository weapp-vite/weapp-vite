import type { ParserOptions, ParserPlugin } from '@babel/parser'
import type * as t from '@babel/types'
import babelGenerate from '@babel/generator'
import { parse as babelParse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import { VISITOR_KEYS } from '@babel/types'

export const BABEL_TS_MODULE_PLUGINS: ParserPlugin[] = [
  'typescript',
  'decorators-legacy',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'jsx',
]

export const BABEL_TS_MODULE_PARSER_OPTIONS: ParserOptions = {
  sourceType: 'module',
  plugins: BABEL_TS_MODULE_PLUGINS,
}

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

export { traverse }
export const generate = babelGenerate
export const parse = babelParse

export function getVisitorKeys() {
  return VISITOR_KEYS
}

export function parseJsLike(source: string): t.File {
  return parse(source, {
    sourceType: 'module',
    plugins: [
      ...BABEL_TS_MODULE_PLUGINS,
      'dynamicImport',
      'optionalChaining',
      'nullishCoalescingOperator',
    ],
  }) as unknown as t.File
}
