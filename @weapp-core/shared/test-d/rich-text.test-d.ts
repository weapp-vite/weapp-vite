import type { RichTextSourceNode, SafeRichTextNode } from '@weapp-core/shared/rich-text'
import { normalizeRichTextNodes, sanitizeRichTextAttributes, sanitizeRichTextStyle } from '@weapp-core/shared/rich-text'
import { expectAssignable, expectType } from 'tsd'

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
