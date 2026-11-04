import type { Document, ParseOptions } from '../../../packages/wxml/src/types'
import type { TemplateApi } from '../assertions'
import { assertTemplate, semanticShape } from '../assertions'
import { equal, invariant } from '../assertions/types'

function element(name: string, selfClosing: boolean, attributes: unknown[] = []) {
  return ['open', name, selfClosing, attributes]
}

/** 八步预言独立维护属性、名称与兄弟顺序，包含结构修改和惰性修改。 */
export function runEditSequence(api: TemplateApi, options: ParseOptions, value: string, onStep?: (step: number, source: string) => void) {
  let document = api.parse('<corpus-root data-v="old" data-v="duplicate"><child/>seed</corpus-root>', options)
  let name = 'corpus-root'
  let attributes: unknown[] = [['data-v', 'old'], ['data-v', 'duplicate']]
  let text = 'seed'
  let prepend = false
  let append = false
  let before = false
  let child = true
  for (let step = 0; step < 8; step++) {
    const oldSource = document.source
    const original = document
    let applied = false
    document = api.edit(document, (handle) => {
      if (applied) {
        return
      }
      if (step < 3 && handle.node.kind === 'element' && handle.node.name === name) {
        if (step === 0) {
          handle.setAttribute('data-v', value)
          attributes = [['data-v', value]]
        }
        else if (step === 1) {
          handle.setBooleanAttribute('enabled')
          attributes = [...attributes, ['enabled', null]]
        }
        else {
          name = 'corpus-edited'
          handle.rename(name)
        }
        applied = true
      }
      else if (step === 3 && handle.node.kind === 'text') {
        text = `edited_${value}`
        handle.replaceText(text)
        applied = true
      }
      else if ((step === 4 || step === 5) && handle.node.kind === 'element' && handle.node.name === name) {
        if (step === 4) {
          handle.append('<appended/>')
          append = true
        }
        else {
          handle.prepend('<prepended/>')
          prepend = true
        }
        applied = true
      }
      else if (step > 5 && handle.node.kind === 'element' && handle.node.name === 'child') {
        if (step === 6) {
          handle.insertBefore('<before-child/>')
          before = true
        }
        else {
          handle.remove()
          child = false
        }
        applied = true
      }
    })
    invariant(applied, 'edit-sequence', `step ${step + 1} did not modify a node`)
    invariant(original.source === oldSource, 'edit-sequence', `step ${step + 1} mutated its input`)
    const expected: unknown[] = [element(name, false, attributes)]
    for (const [present, tag] of [[prepend, 'prepended'], [before, 'before-child'], [child, 'child']] as const) {
      if (present) {
        expected.push(element(tag, true), ['close', tag, true])
      }
    }
    expected.push(['text', text, undefined], ['leave', text, undefined])
    if (append) {
      expected.push(element('appended', true), ['close', 'appended', true])
    }
    expected.push(['close', name, false])
    onStep?.(step + 1, document.source)
    assertTemplate(api, document.source, options)
    equal(semanticShape(api, document), expected, 'edit-sequence', `step ${step + 1} differs from independent edit model`)
    const reparsed: Document = api.parse(api.serialize(document), options)
    equal(semanticShape(api, reparsed), expected, 'edit-sequence', `step ${step + 1} reparse differs from independent edit model`)
  }
  return document.source
}
