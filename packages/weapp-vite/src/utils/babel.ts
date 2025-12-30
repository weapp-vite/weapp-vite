import type { ParserOptions, ParserPlugin } from '@babel/parser'

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
