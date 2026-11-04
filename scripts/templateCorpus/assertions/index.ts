import type { ParseOptions } from '../../../packages/wxml/src/types'
import type { CorpusExpectation } from '../types'
import type { AssertionMetrics, TemplateApi } from './types'
import { assertEdit } from './edit'
import { assertRanges } from './ranges'
import { assertTree, semanticShape } from './tree'
import { equal, invariant, rejects } from './types'

export { semanticShape } from './tree'
export type { AssertionMetrics, TemplateApi } from './types'
export { CorpusAssertionError } from './types'

/** 预期由冻结来源确定，绝不根据本次解析结果反向分类。 */
export function assertTemplate(api: TemplateApi, source: string, options: ParseOptions, expectation: CorpusExpectation = 'valid', diagnosticCodes: readonly string[] = []): AssertionMetrics {
  invariant(expectation !== 'pending', 'expectation', 'unresolved corpus classification blocks acceptance')
  const scanned = api.scan(source, options)
  const document = api.parse(source, options)
  equal(scanned, { tokens: document.tokens, diagnostics: document.diagnostics }, 'scan-parse', 'scan and parse disagree')
  for (const diagnostic of document.diagnostics) {
    invariant(Number.isInteger(diagnostic.start) && Number.isInteger(diagnostic.end) && diagnostic.start >= 0 && diagnostic.end >= diagnostic.start && diagnostic.end <= source.length, 'diagnostics', 'diagnostic range is not a UTF-16 half-open source range')
  }
  const errors = document.diagnostics.filter(diagnostic => diagnostic.severity === 'error')
  if (expectation === 'invalid') {
    invariant(errors.length > 0, 'diagnostics', 'known-invalid input has no error')
    invariant(diagnosticCodes.every(code => errors.some(diagnostic => diagnostic.code === code)), 'diagnostics', 'expected diagnostic code missing')
    rejects(() => api.serialize(document), 'invalid-serialize', 'invalid document was serialized')
    rejects(() => api.serialize(document, { mode: 'canonical' }), 'invalid-serialize', 'invalid document was canonicalized')
    rejects(() => api.edit(document, () => {}), 'invalid-edit', 'invalid document was editable')
    return { tokens: document.tokens.length, nodes: 0, elements: 0, attributes: 0, edits: 0 }
  }
  invariant(errors.length === 0, 'parse', errors.map(error => `${error.code}@${error.start}: ${error.message}`).join('; '))
  assertRanges(document)
  const metrics = assertTree(api, document)
  invariant(api.serialize(document) === source, 'preserve', 'preserve output is not identical to source')
  const canonical = api.serialize(document, { mode: 'canonical' })
  const reparsed = api.parse(canonical, options)
  invariant(!reparsed.diagnostics.some(diagnostic => diagnostic.severity === 'error'), 'canonical', 'canonical output is invalid')
  equal(semanticShape(api, reparsed), semanticShape(api, document), 'canonical-semantics', 'canonical output changes text, bindings, names or ordered attributes')
  invariant(api.serialize(reparsed, { mode: 'canonical' }) === canonical, 'canonical-idempotence', 'canonical output is not idempotent')
  return { ...metrics, edits: assertEdit(api, document) }
}
