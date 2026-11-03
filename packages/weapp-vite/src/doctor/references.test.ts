import type { MpPlatform } from '../types'
import type { DoctorArtifactSnapshot, DoctorReport } from './types'
import { describe, expect, it } from 'vitest'
import { getPlatformOutputExtensions } from '../platform'
import { checkArtifactReferences } from './references'

function check(template: string, target: MpPlatform = 'weapp', files: Record<string, string> = {}) {
  const report: DoctorReport = { schemaVersion: 1, generatedAt: '2026-01-01T00:00:00Z', targets: [target], diagnostics: [], coverage: [], artifacts: {}, runtime: {}, exitCode: 0 }
  const snapshot: DoctorArtifactSnapshot = {
    origin: 'build',
    freshness: 'current-build',
    capturedAt: report.generatedAt,
    files: Object.entries({ [`pages/index.${getPlatformOutputExtensions(target).wxml}`]: template, ...files })
      .map(([path, text]) => ({ path, text, size: text.length, sha256: 'fixture' })),
  }
  checkArtifactReferences(report, target, snapshot, { subPackageRoots: new Set(), independentRoots: new Set() })
  return report
}

describe('Doctor shared template reference scan', () => {
  it('decodes entities, retains the first duplicate source and skips bare or empty sources', () => {
    const report = check('<include src="one&amp;two.wxml" src="missing.wxml"/><include src/><import src=""/>', 'weapp', { 'pages/one&two.wxml': '<view/>' })
    expect(report.diagnostics).toEqual([])
    expect(report.coverage.every(item => item.status === 'complete')).toBe(true)
  })

  it('ignores fake imports in script strings, comments and CDATA', () => {
    const source = `<wxs>var html = '<include src="missing-script.wxml"/>';</wxs><!-- <include src="missing-comment.wxml"/> --><![CDATA[<import src="missing-cdata.wxml"/>]]><view/>`
    expect(check(source).diagnostics).toEqual([])
  })

  it('does not make a WeChat filter component opaque', () => {
    const report = check('<filter><include src="missing.wxml"/></filter>')
    expect(report.diagnostics).toContainEqual(expect.objectContaining({ ruleId: 'doctor/artifact/missing-import', evidence: expect.objectContaining({ actual: 'missing.wxml' }) }))
  })

  it.each([
    { target: 'alipay', source: '<import-sjs from="module.sjs"/>', file: 'module.sjs' },
    { target: 'swan', source: '<import-sjs src="module.sjs"/>', file: 'module.sjs' },
    { target: 'swan', source: '<filter src="module.filter.js"/>', file: 'module.filter.js' },
    { target: 'tt', source: '<sjs src="module.sjs"/>', file: 'module.sjs' },
  ] as const)('uses platform-owned module import attributes for $target: $source', ({ target, source, file }) => {
    expect(check(source, target).diagnostics).toContainEqual(expect.objectContaining({ ruleId: 'doctor/artifact/missing-import', evidence: expect.objectContaining({ actual: file }) }))
    expect(check(source, target, { [`pages/${file}`]: '' }).diagnostics).toEqual([])
  })

  it('keeps dynamic and external references explicitly incomplete', () => {
    const report = check('<include src="{{ path }}"/><import src="https://example.invalid/template.wxml"/>')
    expect(report.diagnostics).toEqual([])
    expect(report.coverage.filter(item => item.check === 'references' && item.status === 'incomplete')).toHaveLength(2)
  })

  it('marks invalid templates incomplete without publishing a partial reference graph', () => {
    const report = check('<include src="missing.wxml"/><view>')
    expect(report.diagnostics).toEqual([])
    expect(report.coverage).toContainEqual(expect.objectContaining({ check: 'reference-parse', status: 'incomplete' }))
  })

  it('keeps XML literal backslashes in final artifact reference values', () => {
    const report = check(String.raw`<include src="tail\"/>`)
    expect(report.diagnostics).toContainEqual(expect.objectContaining({ evidence: expect.objectContaining({ actual: 'tail\\' }) }))
  })
})
