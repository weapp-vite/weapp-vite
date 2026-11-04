import type { Document } from '../../../packages/wxml/src/types'
import type { TemplateApi } from './types'
import { semanticShape } from './tree'
import { equal, invariant, rejects } from './types'

/** 每份语料执行真正的属性和文本修改，并验证会话隔离与重解析。 */
export function assertEdit(api: TemplateApi, document: Document) {
  const originalShape = semanticShape(api, document)
  const source = document.source
  let attributes = 0
  let texts = 0
  let expired: (() => void) | undefined
  let markerName = 'data-corpus-probe'
  while (source.includes(markerName)) {
    markerName += '-x'
  }
  const edited = api.edit(document, (handle) => {
    expired ??= handle.remove
    if (handle.node.kind === 'element' && !attributes) {
      handle.setAttribute(markerName, 'corpus_attribute_😀')
      attributes++
    }
    if (handle.node.kind === 'text' && !texts) {
      handle.replaceText('corpus_text_😀')
      texts++
    }
  })
  invariant(edited !== document && document.source === source && api.serialize(document) === source, 'edit', 'editing changed original document')
  equal(semanticShape(api, document), originalShape, 'edit', 'editing changed original tree')
  if (expired) {
    rejects(expired, 'edit-lifecycle', 'handle remains active after visitor session')
  }
  const output = api.serialize(edited)
  const reparsed = api.parse(output, document.options)
  invariant(!reparsed.diagnostics.some(diagnostic => diagnostic.severity === 'error'), 'edit', 'edited output cannot be reparsed')
  equal(semanticShape(api, edited), semanticShape(api, reparsed), 'edit', 'lazy edited tree differs from reparsed output')
  invariant(!attributes || output.includes(`${markerName}="corpus_attribute_😀"`), 'edit', 'attribute modification disappeared')
  invariant(!texts || output.includes('corpus_text_😀'), 'edit', 'text modification disappeared')
  const canonical = api.serialize(edited, { mode: 'canonical' })
  equal(semanticShape(api, api.parse(canonical, document.options)), semanticShape(api, reparsed), 'edit', 'canonical edited output changes semantics')
  return attributes + texts
}
