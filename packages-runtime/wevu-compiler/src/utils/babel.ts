import {
  generate as babelGenerate,
  parse as babelParse,
  parseJsLike as babelParseJsLike,
  traverse as babelTraverse,
} from '@weapp-vite/ast/babel'
import { countCompilerOperation } from '../profiling/internal'

export { BABEL_TS_MODULE_PARSER_OPTIONS, BABEL_TS_MODULE_PLUGINS, getVisitorKeys } from '@weapp-vite/ast/babel'

export const parse: typeof babelParse = (...args: Parameters<typeof babelParse>) => {
  countCompilerOperation('babelParseCalls')
  return babelParse(...args)
}

export const parseJsLike: typeof babelParseJsLike = (source) => {
  countCompilerOperation('babelParseCalls')
  return babelParseJsLike(source)
}

export const generate: typeof babelGenerate = (...args) => {
  countCompilerOperation('babelGenerateCalls')
  return babelGenerate(...args)
}

export const traverse: typeof babelTraverse = (...args) => {
  countCompilerOperation('babelTraverseCalls')
  return babelTraverse(...args)
}
