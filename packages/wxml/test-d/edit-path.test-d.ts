import type { Document, EditElement, EditPath, EditVisitors, TemplateDocument } from '@weapp-vite/wxml'
import { edit, parse } from '@weapp-vite/wxml'
import { compileDialect, edit as coreEdit, createParser } from '@weapp-vite/wxml/core'
import { expectError, expectType } from 'tsd'

const document = parse('<view/>')
expectType<Document>(edit(document, {
  Element(path, state: { count: number }) {
    expectType<EditPath<EditElement>>(path)
    expectType<EditElement>(path.node)
    expectType<EditPath | undefined>(path.parentPath)
    expectType<readonly EditPath[]>(path.get('children'))
    expectType<EditPath | undefined>(path.findParent(parent => parent.isElement('view')))
    expectType<readonly EditPath[]>(path.replaceWith('<text/>'))
    state.count++
    expectError(path.node.kind = 'text')
    expectError(path.node.start)
    expectError(path.get('invalid'))
    expectError(path.setAttribute('title', {}))
  },
}, { count: 0 }))

const visitor: EditVisitors<{ visits: number }> = {
  enter(path, state) {
    state.visits++
    path.skip()
    path.stop()
    path.requeue()
  },
  Element: { exit(path, state) {
    expectType<number>(state.visits)
    path.traverse({ Text(child) {
      child.replaceText('value')
    } })
  } },
}
expectType<Document>(edit(document, visitor, { visits: 0 }))
expectError(edit(document, visitor))

const parser = createParser(compileDialect({ id: 'custom', syntax: 'xml', rawTags: [] }))
expectType<TemplateDocument>(coreEdit(parser.parse('<root/>'), {
  Element(path) { path.setBooleanAttribute('ready') },
}))
