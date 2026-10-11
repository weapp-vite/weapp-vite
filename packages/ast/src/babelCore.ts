import * as babelCore from '@babel/core'

export const {
  parse,
  parseAsync,
  parseSync,
  transform,
  transformAsync,
  transformFile,
  transformFileAsync,
  transformFileSync,
  transformFromAst,
  transformFromAstAsync,
  transformFromAstSync,
  transformSync,
  types,
  version,
} = babelCore

export default babelCore
export type { NodePath, InputOptions as TransformOptions } from '@babel/core'
