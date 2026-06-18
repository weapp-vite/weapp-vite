import type * as BabelCore from '@babel/core'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)
const babelCore = nodeRequire('@babel/core') as typeof BabelCore

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
