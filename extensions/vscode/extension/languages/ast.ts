import type { ParserOptions, ParserPlugin } from '@babel/parser'

// VSIX 不附带 node_modules，静态入口使打包器包含共享分析所需的 Babel 实现。
export { parse } from '@babel/parser'
export { default as traverse } from '@babel/traverse'

export const BABEL_TS_MODULE_PLUGINS: ParserPlugin[] = ['typescript', 'decorators-legacy', 'jsx']
export const BABEL_TS_MODULE_PARSER_OPTIONS: ParserOptions = {
  sourceType: 'module',
  plugins: BABEL_TS_MODULE_PLUGINS,
}
