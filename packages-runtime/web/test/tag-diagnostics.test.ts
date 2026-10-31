import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml/compile'

describe('source-owned WXML tag diagnostics', () => {
  it('records the first original location and distinguishes unsupported native tags', () => {
    const source = '<view>\r\n  <buton /><buton />\r\n  <web-view />\r\n</view>'
    const result = compileWxml({
      id: 'pages/home/index.wxml',
      source,
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })
    expect(result.tagDiagnostics).toEqual([
      expect.objectContaining({ tag: 'buton', reason: 'unknown', filename: 'pages/home/index.wxml', line: 2, column: 3 }),
      expect.objectContaining({ tag: 'web-view', reason: 'unsupported', line: 3, column: 3 }),
    ])
    expect(result.warnings ?? []).toEqual([])
  })

  it('diagnoses original layout input and accepts registered and platform control tags', () => {
    const diagnosticSource = '<view>\n  <order-card /><wx-import src="./empty.wxml" /><wx-include src="./empty.wxml" />\n  <button /><div /><svg><path /></svg><math><mi /></math>\n</view>'
    const result = compileWxml({
      id: 'pages/home/index.wxml',
      source: `<block><injected-layout>${diagnosticSource}</injected-layout></block>`,
      diagnosticSource,
      componentTags: { 'order-card': 'registered-card' },
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })
    expect(result.tagDiagnostics).toEqual([])
  })

  it('does not diagnose inline WXS strings or ignored dependency subtrees', () => {
    const result = compileWxml({
      id: 'pages/home/index.wxml',
      source: '<wxs module="helpers">module.exports = "<phantom-card />"</wxs><include src="./missing.wxml"><unused-card /></include>',
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })
    expect(result.tagDiagnostics).toEqual([])
  })

  it('merges original AST diagnostics with dependency-owned sources without inspecting generated root tags', async () => {
    const root = await mkdtemp(join(tmpdir(), 'web-tag-original-ast-'))
    try {
      const dependency = join(root, 'part.wxml')
      await writeFile(dependency, '<view>\n  <dependency-typo /><registered-card />\n</view>')
      const original = { tag: 'source-typo', reason: 'unknown' as const, filename: join(root, 'index.vue'), line: 7, column: 5 }
      const result = compileWxml({
        id: join(root, 'index.vue'),
        source: '<generated-wrapper><include src="./part.wxml" /></generated-wrapper>',
        sourceTagDiagnostics: [original],
        componentTags: { 'registered-card': 'resolved-card' },
        resolveTemplatePath: raw => resolve(root, raw),
        resolveWxsPath: () => undefined,
      })
      expect(result.tagDiagnostics).toEqual([
        original,
        { tag: 'dependency-typo', reason: 'unknown', filename: dependency, line: 2, column: 3 },
      ])
      expect(result.dependencies).toEqual([dependency])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
