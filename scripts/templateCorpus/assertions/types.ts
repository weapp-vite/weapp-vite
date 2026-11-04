import type { Attribute, Document, EditVisitor, Node, ParseOptions, ScanResult, SerializeOptions, Syntax, Visitor } from '../../../packages/wxml/src/types'

/** 源码、构建入口与浏览器使用相同断言，不依赖测试框架或 Node。 */
export interface TemplateApi {
  scan: (source: string, options?: ParseOptions) => ScanResult
  parse: (source: string, options?: ParseOptions) => Document
  serialize: (document: Document, options?: SerializeOptions) => string
  walk: (document: Document | readonly Node[], visitor: Visitor) => void
  edit: (document: Document, visitor: EditVisitor) => Document
  decodeAttribute: (value: string, syntax?: Syntax, decodeEntities?: boolean, quote?: Attribute['quote']) => string
}

export interface AssertionMetrics {
  tokens: number
  nodes: number
  elements: number
  attributes: number
  edits: number
}

export class CorpusAssertionError extends Error {
  constructor(readonly stage: string, message: string) {
    super(`${stage}: ${message}`)
    this.name = 'CorpusAssertionError'
  }
}

export function invariant(condition: unknown, stage: string, message: string): asserts condition {
  if (!condition) {
    throw new CorpusAssertionError(stage, message)
  }
}

export function equal(actual: unknown, expected: unknown, stage: string, message: string) {
  invariant(JSON.stringify(actual) === JSON.stringify(expected), stage, message)
}

export function rejects(operation: () => unknown, stage: string, message: string) {
  let rejected = false
  try {
    operation()
  }
  catch {
    rejected = true
  }
  invariant(rejected, stage, message)
}
