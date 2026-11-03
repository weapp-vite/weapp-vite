import { describe, expect, it } from 'vitest'
import { getScriptModuleTagNames } from '../../utils/wxmlScriptModule'
import { createWxmlRemover } from '../remove'
import { scanTemplate } from '../template/scan'
import { editWxml } from './editor'

const file = 'pages/encoding/index.wxml'
const scriptTags = new Set(getScriptModuleTagNames())
const cases = [
  { expression: String.raw`'a\'b'`, legacy: String.raw`{{'a\\'b'}}`, xml: String.raw`{{'a\'b'}}` },
  { expression: String.raw`"a\"b"`, legacy: String.raw`{{\"a\\\"b\"}}`, xml: String.raw`{{&quot;a\&quot;b&quot;}}` },
  { expression: String.raw`'tail\\'`, legacy: String.raw`{{'tail\\\\'}}`, xml: String.raw`{{'tail\\'}}` },
  { expression: String.raw`"tail\\"`, legacy: String.raw`{{\"tail\\\\\"}}`, xml: String.raw`{{&quot;tail\\&quot;}}` },
  { expression: String.raw`'a\\\'b'`, legacy: String.raw`{{'a\\\\\\'b'}}`, xml: String.raw`{{'a\\\'b'}}` },
  { expression: String.raw`"a\\\"b"`, legacy: String.raw`{{\"a\\\\\\\"b\"}}`, xml: String.raw`{{&quot;a\\\&quot;b&quot;}}` },
]

describe('public template setters and shared lexical boundaries', () => {
  it.each(['legacy', 'xml'] as const)('retains same/opposite quote escapes and slash parity across %s setters, scans and cleanup', async (syntax) => {
    for (const item of cases) {
      const value = item[syntax]
      const output = await editWxml('<view data-testid="drop"/>', file, syntax, node => node.setAttribute('probe', { expression: item.expression }))
      expect(output, item.expression).toBe(`<view data-testid="drop" probe="${value}"/>`)
      const { elements } = scanTemplate(output, file, scriptTags, false, syntax)
      const attribute = elements[0]!.attrs.find(attribute => attribute.name === 'probe')!
      expect(output.slice(attribute.valueStart, attribute.valueEnd), item.expression).toBe(value)
      expect(await editWxml(output, file, syntax, (node) => {
        expect(node.getAttribute('probe')?.rawValue, item.expression).toBe(value)
      })).toBe(output)
      expect(createWxmlRemover({ attr: ['data-testid'] })(output, file, syntax), item.expression)
        .toBe(`<view  probe="${value}"/>`)
    }
  })
})
