import type { Document, EditableNode, ElementNode, Node, ScanResult } from '@weapp-vite/wxml'
import { edit, parse, scan, serialize, walk } from '@weapp-vite/wxml'
import { expectError, expectType } from 'tsd'

const document = parse('<view disabled />', { platform: 'weapp', syntax: 'legacy' })
expectType<Document>(document)
expectType<ScanResult>(scan('<view />', { platform: 'alipay' }))
expectType<string>(serialize(document, { mode: 'preserve' }))
expectType<string>(serialize(document, { mode: 'canonical' }))
expectType<Document>(edit(document, (handle) => {
  expectType<EditableNode>(handle)
  handle.setAttribute('title', 'literal {{ braces }}')
  handle.setAttribute('count', { expression: 'count + 1' })
  handle.setBooleanAttribute('hidden')
}))
walk(document, { enter(node, parent) {
  expectType<Node>(node)
  expectType<ElementNode | undefined>(parent)
  expectError(node.start = 0)
} })
expectError(document.source = '')
expectError(document.children.push(document.children[0]))
expectError(parse('', { platform: 'web' }))
expectError(serialize(document, { mode: 'html' }))
