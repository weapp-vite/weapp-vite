import type { Document } from '@weapp-vite/wxml'
import type { CompiledDialect, EditableNode, ScanResult, TemplateDocument, TemplateParser } from '@weapp-vite/wxml/core'
import { edit, parse } from '@weapp-vite/wxml'
import { compileDialect, createParser, edit as editCore, serialize, walk } from '@weapp-vite/wxml/core'
import { expectAssignable, expectError, expectType } from 'tsd'

const dialect = compileDialect({ id: 'core', syntax: 'xml', rawTags: ['opaque'] })
expectType<CompiledDialect>(dialect)
expectType<readonly string[]>(dialect.rawTags)
expectError(dialect.rawTagSet)
expectError(dialect.matchesRawTag)
const parser = createParser(dialect)
expectType<TemplateParser>(parser)
expectType<ScanResult>(parser.scan('<opaque/>'))
expectType<ScanResult>(parser.scanComments('<!-- comment -->'))
const coreDocument = parser.parse('<opaque/>')
expectType<TemplateDocument>(coreDocument)
expectError(coreDocument.platform)
expectError(coreDocument.options)
expectType<TemplateDocument>(editCore(coreDocument, (handle) => {
  expectType<EditableNode>(handle)
  handle.setBooleanAttribute('disabled')
}))
expectType<string>(serialize(coreDocument))
walk(coreDocument, { enter(node) {
  expectError(node.start = 0)
} })

const legacyDocument = parse('<view/>')
expectType<Document>(legacyDocument)
expectType<Document>(edit(legacyDocument, () => {}))
expectError(parser.parse('<opaque/>', { syntax: 'xml' }))
expectAssignable<Document>({
  source: '<view/>',
  platform: 'weapp',
  syntax: 'legacy',
  diagnostics: [],
  options: { platform: 'weapp', syntax: 'legacy' },
  children: [],
  tokens: [],
})
// 运行时会拒绝失去 WeakMap 关联的结构化文档；TypeScript 无法区分展开复制。
