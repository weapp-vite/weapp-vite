import type { CompiledDialect, ParseOptions, TemplateParser } from './types'
import { compiledState } from './dialect'
import { parseContext } from './documentContext'
import { scanCompiledDocument } from './scannerCore'

/** 将编译方言绑定一次，同一解析器复用不可变配置和 matcher。 */
export function createParser(dialect: CompiledDialect, options: Pick<ParseOptions, 'resolveScriptBoundary'> = {}): TemplateParser {
  const state = compiledState(dialect)
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Expected parser options.')
  }
  const resolver = options.resolveScriptBoundary
  if (resolver !== undefined && typeof resolver !== 'function') {
    throw new TypeError('Expected resolveScriptBoundary to be a function.')
  }
  const context = Object.freeze({ dialect, state, resolveScriptBoundary: resolver })
  return Object.freeze({
    dialect,
    scan: (source: string) => scanCompiledDocument(source, state, context.resolveScriptBoundary, false),
    scanComments: (source: string) => scanCompiledDocument(source, state, context.resolveScriptBoundary, false, true),
    parse: (source: string) => parseContext(source, context),
  })
}

export { decodeAttribute } from './decode'
export { compileDialect } from './dialect'
export { edit } from './edit'
export { expressionEnd, interpolations } from './expression'
export { TemplateLexicalError } from './lexical'
export { findScriptClosingTag, findTrailingScriptComment, scanScriptBoundaryCandidates } from './script'
export { serialize } from './serialize'
export { readTag } from './tag'
export type * from './types'
export { walk } from './walk'
