import type { RichTextSourceNode, SafeRichTextNode } from '@weapp-core/shared/rich-text'
import { normalizeNativeRichTextNodes, normalizeRichTextNodes, sanitizeNativeRichTextAttributes, sanitizeRichTextAttributes, sanitizeRichTextStyle } from '@weapp-core/shared/rich-text'
import { expectAssignable, expectError, expectType } from 'tsd'

const source: RichTextSourceNode = {
  name: 'p',
  attrs: { class: 'lead' },
  children: [{ type: 'text', text: 'Rendered content' }],
}
expectType<SafeRichTextNode[]>(normalizeRichTextNodes([source]))
expectType<SafeRichTextNode[]>(normalizeRichTextNodes('<p>Rendered content</p>'))
expectType<SafeRichTextNode[]>(normalizeRichTextNodes(null))
expectType<string>(sanitizeRichTextStyle({ color: 'red' }))
expectAssignable<Record<string, string>>(sanitizeRichTextAttributes({ onclick: 'unsafe()', title: 'safe' }, 'p'))

expectType<SafeRichTextNode[]>(normalizeNativeRichTextNodes([source]))
expectType<SafeRichTextNode[]>(normalizeNativeRichTextNodes('<NAV>&amp;amp;</NAV>'))
expectType<SafeRichTextNode[]>(normalizeNativeRichTextNodes(null))
expectAssignable<Record<string, string>>(sanitizeNativeRichTextAttributes({ class: 'safe', id: 'rejected' }, 'p'))
expectError(normalizeRichTextNodes(source, { native: true }))
expectError(sanitizeRichTextAttributes({}, 'p', { native: true }))

for (const node of normalizeRichTextNodes(source)) {
  if (node.type === 'text') {
    expectType<string>(node.text)
  }
  else {
    expectType<string>(node.name)
    expectType<Record<string, string>>(node.attrs)
    expectType<SafeRichTextNode[]>(node.children)
  }
}
