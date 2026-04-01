import type { ParserOptions, ParserPlugin } from '@babel/parser'
import type * as t from '@babel/types'
import babelGenerateModule from '@babel/generator'
import * as babelParser from '@babel/parser'
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
const generate = (babelGenerateModule as unknown as { default?: typeof babelGenerateModule }).default ?? babelGenerateModule
const parse = babelParser.parse

export { traverse }
export { generate, parse }

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
