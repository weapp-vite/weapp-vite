import { describe, expect, it } from 'vitest'
import { expectedSnapshotsToDocuments, extractStaticSnapshots } from './expected'

function frozenSnapshot(files: Array<[string, string]>, key = 'target output') {
  const value = files.map(([file, source]) => `\n/** filePath: ${file} **/\n${source}`).join('')
  const pretty = `"${value.replace(/["\\]/g, '\\$&')}"`
  return { value, input: `throw new Error("do not execute"); exports[${JSON.stringify(key)}] = ${JSON.stringify(pretty)}` }
}

describe('static bundle file-section snapshots', () => {
  it('selects exact reviewed template paths and preserves source, key and both UTF-16 ranges', () => {
    const template = ' \r\n<jds module="xs" src="./utils.jds"/>\r\n<view>😀</view>\r\n'
    const frozen = frozenSnapshot([
      ['dist/app.js', 'const source = "<View prop={value}/>";'],
      ['dist/base.jxml', template],
      ['dist/app.jxss', 'view{color:red}'],
      ['dist/pages/index/index.jxml', '<import src="../../base.jxml"/>'],
    ])
    expect(extractStaticSnapshots(frozen.input, 'jest').snapshots).toEqual([])
    const extraction = extractStaticSnapshots(frozen.input, 'jest-files', ['dist/base.jxml', 'dist/pages/index/index.jxml'])
    expect(extraction.rejected).toEqual([])
    expect(extraction.snapshots.map(snapshot => snapshot.source)).toEqual([template, '<import src="../../base.jxml"/>'])
    for (const snapshot of extraction.snapshots) {
      expect(snapshot.key).toBe('target output')
      expect(frozen.input.slice(snapshot.start, snapshot.end)).toContain('exports[')
      expect(frozen.value.slice(snapshot.section!.start, snapshot.section!.end)).toBe(snapshot.source)
    }
    const documents = expectedSnapshotsToDocuments(extraction, { repository: 'owner/upstream', commit: 'a'.repeat(40), licenseId: 'MIT' }, 'tests/output.snap', 'jd-xml', 'jest-files', ['target output'])
    expect(documents[0]!.origins[0]!.snapshot).toEqual({ format: 'jest-files', key: 'target output', start: extraction.snapshots[0]!.start, end: extraction.snapshots[0]!.end, section: extraction.snapshots[0]!.section })
    expect(documents[0]!.origins[0]!.evidence).toContain('snapshot-file:dist/base.jxml')
  })

  it('rejects absent files, duplicate paths and unsafe paths without classifying template text', () => {
    const absent = frozenSnapshot([['dist/base.axml', '<view/>']])
    expect(extractStaticSnapshots(absent.input, 'jest-files', ['dist/missing.axml']).rejected[0]!.reason).toContain('missing')
    const duplicate = frozenSnapshot([['dist/base.axml', '<view/>'], ['dist/base.axml', '<text/>']])
    expect(extractStaticSnapshots(duplicate.input, 'jest-files', ['dist/base.axml']).rejected[0]!.reason).toContain('duplicate')
    const unsafe = frozenSnapshot([['../app.js', 'code'], ['dist/base.axml', '<view/>']])
    expect(extractStaticSnapshots(unsafe.input, 'jest-files', ['dist/base.axml']).rejected[0]!.reason).toContain('Unsafe')
    const text = frozenSnapshot([['dist/base.axml', 'plain 😀 text\r\n'], ['dist/empty.axml', '']])
    expect(extractStaticSnapshots(text.input, 'jest-files', ['dist/base.axml', 'dist/empty.axml']).snapshots.map(snapshot => snapshot.source)).toEqual(['plain 😀 text\r\n', ''])
  })

  it('requires an explicit markup whitelist and the frozen serializer protocol', () => {
    for (const files of [undefined, [], ['dist/app.js'], ['dist/index.jsx'], ['dist/app.css'], ['../base.wxml'], ['dist/base.wxml', 'dist/base.wxml']]) {
      expect(() => extractStaticSnapshots('', 'jest-files', files)).toThrow('explicit portable markup')
    }
    expect(() => extractStaticSnapshots('', 'literal', ['dist/base.wxml'])).toThrow('jest-files')
    const malformed = `exports["bad"] = ${JSON.stringify('"/** filePath: dist/base.wxml **/\n<view/>\n"')}`
    expect(extractStaticSnapshots(malformed, 'jest-files', ['dist/base.wxml']).rejected[0]!.reason).toContain('serializer')
    const expression = '${' + 'execute()}'
    const dynamic = `exports["dynamic"] = \`"\n/** filePath: dist/base.wxml **/\n${expression}\n"\``
    expect(extractStaticSnapshots(dynamic, 'jest-files', ['dist/base.wxml']).rejected[0]!.reason).toContain('dynamic expression')
  })

  it('accepts the official Taro normalized serializer layout with an initial empty stylesheet', () => {
    const value = '\n/** filePath: dist/app.acss **/\n\n/** filePath: dist/app.js **/\n"use strict";\n\n/** filePath: dist/base.axml **/\n<view/>\n'
    const input = `exports["mini-platform alipay should build alipay app 2"] = ${JSON.stringify(`"${value}"`)}`
    const extraction = extractStaticSnapshots(input, 'jest-files', ['dist/base.axml'])
    expect(extraction.rejected).toEqual([])
    expect(extraction.snapshots[0]!.source).toBe('<view/>\n')
    expect(value.slice(extraction.snapshots[0]!.section!.start, extraction.snapshots[0]!.section!.end)).toBe('<view/>\n')
  })
})
