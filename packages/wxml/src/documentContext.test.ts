import type { DocumentContext } from './documentContext'
import type { Document, TemplateDocument } from './types'
import { describe, expect, it } from 'vitest'
import { compileDialect, createParser, edit as editCore } from './core'
import { contextFor, parseContext } from './documentContext'
import { copyDocument } from './edit/document'
import { edit, parse } from './index'

const commonFields = ['source', 'syntax', 'tokens', 'diagnostics', 'children']
const compatibilityFields = ['source', 'platform', 'syntax', 'tokens', 'diagnostics', 'children', 'options']

function expectPlainDocument(document: TemplateDocument, fields: string[]) {
  expect(Object.getPrototypeOf(document)).toBe(Object.prototype)
  expect(Object.keys(document)).toEqual(fields)
  expect(contextFor(document)).toBeDefined()
}

describe('context-owned document construction', () => {
  it('uses one compatibility shape for parsing, copying, complete edits and lazy materialization', () => {
    const original = parse('<root><child/></root>', { platform: 'alipay', syntax: 'xml' })
    const unchanged = edit(original, () => {})
    const structural = edit(original, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'child') {
        handle.replaceWith('<next/>')
      }
    })
    const lazy = edit(original, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'root') {
        handle.setAttribute('title', 'new')
      }
    })
    const materialized = edit(lazy, () => {})
    const jsonCopy = copyDocument(lazy)
    const context = contextFor(original)
    for (const document of [original, unchanged, structural, materialized, jsonCopy]) {
      expectPlainDocument(document, compatibilityFields)
      expect(contextFor(document)).toBe(context)
      expect((document as Document).options).toBe(original.options)
      expect((document as Document).platform).toBe('alipay')
      expect(editCore(document, () => {}).source).toBe(document.source)
    }
    expect(unchanged).not.toBe(original)
    expect(unchanged.children).toBe(original.children)
    expect(structural.source).toBe('<root><next/></root>')
    expect(materialized.source).toBe('<root title="new"><child/></root>')
    expect(jsonCopy.source).toBe(materialized.source)
    expect(original.source).toBe('<root><child/></root>')
  })

  it('keeps core construction independent of compatibility metadata across the same edit paths', () => {
    const parser = createParser(compileDialect({ id: 'plain-context', syntax: 'xml', rawTags: [] }))
    const original = parser.parse('<root><child/></root>')
    const unchanged = editCore(original, () => {})
    const structural = editCore(original, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'child') {
        handle.replaceWith('<next/>')
      }
    })
    const lazy = editCore(original, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'root') {
        handle.setAttribute('title', 'new')
      }
    })
    const materialized = editCore(lazy, () => {})
    for (const document of [original, unchanged, structural, materialized, copyDocument(lazy)]) {
      expectPlainDocument(document, commonFields)
      expect(contextFor(document)).toBe(contextFor(original))
      expect(editCore(document, () => {}).source).toBe(document.source)
    }
    const context: DocumentContext = { ...contextFor(original)!, metadata: { platform: 'unrelated', options: {} } }
    expectPlainDocument(parseContext('<independent/>', context), commonFields)
  })

  it('reuses a readonly factory without capturing a previously parsed source', () => {
    const first = parse('<first/>')
    const second = parse('<second/>')
    const context = contextFor(first)!
    expect(contextFor(second)).toBe(context)
    expect(Object.isFrozen(context)).toBe(true)
    expect(first.source).toBe('<first/>')
    expect(second.source).toBe('<second/>')
    const third = parseContext('<third/>', context)
    expect(third.source).toBe('<third/>')
    expect(contextFor(third)).toBe(context)
    expect(Object.keys(third)).toEqual(compatibilityFields)
  })

  it('validates source before consulting a context factory and preserves detached-document rejection', () => {
    const document = parse('<view/>')
    const context: DocumentContext = {
      ...contextFor(document)!,
      get createDocument(): never { throw new Error('The factory must not be read before source validation') },
    }
    expect(() => parseContext(null as never, context)).toThrow('Expected template source.')
    const parser = createParser(compileDialect({ id: 'detached', syntax: 'xml', rawTags: [] }))
    const detached = { ...parser.parse('<view/>') }
    expect(() => edit(detached, () => {})).toThrow(/context|parser/i)
    expect(() => editCore(detached, () => {})).toThrow(/context|parser/i)
    const legacy = { ...document }
    const restored = edit(legacy, () => {})
    expectPlainDocument(restored, compatibilityFields)
    expect(contextFor(restored)).toBe(contextFor(document))
  })
})
