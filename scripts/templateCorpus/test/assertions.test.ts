import { describe, expect, it } from 'vitest'
import * as api from '../../../packages/wxml/src/index'
import { assertTemplate } from '../assertions'
import { runCorpusCases } from '../assertions/corpus'
import { runSyntaxMatrix } from '../assertions/syntax'
import { corpusProfiles } from '../profiles'

describe('shared corpus assertions', () => {
  it('runs the identical contract over each frozen lexical profile', () => {
    const scenarios = runSyntaxMatrix(api, corpusProfiles)
    expect(Object.keys(scenarios)).toEqual(corpusProfiles.map(profile => profile.id))
    expect(scenarios['jd-xml']).toContain('raw-jds-pseudo-markup')
    expect(scenarios['qq-xml']).toContain('raw-qs-pseudo-markup')
  })

  it('detects preservation, token partition and visitor regressions independently', () => {
    expect(() => assertTemplate({ ...api, serialize: () => '' }, '<view/>', {})).toThrow('preserve')
    const inconsistent = { ...api, scan: () => ({ tokens: [], diagnostics: [] }) }
    expect(() => assertTemplate(inconsistent, '<view/>', {})).toThrow('scan-parse')
    expect(() => assertTemplate({ ...api, walk: () => {} }, '<view/>', {})).toThrow('walk')
  })

  it('requires explicit invalid diagnostics and refuses pending classifications', () => {
    expect(assertTemplate(api, '<view>', {}, 'invalid', ['template/unclosed-tag']).edits).toBe(0)
    expect(() => assertTemplate(api, '<view>', {}, 'invalid', ['unrelated/code'])).toThrow('diagnostics')
    expect(() => assertTemplate(api, '<view/>', {}, 'invalid')).toThrow('no error')
    expect(() => assertTemplate(api, '<view/>', {}, 'pending')).toThrow('unresolved')
  })

  it('deduplicates by profile and records unresolved origins as blocking failures', () => {
    const origin = { repository: 'owner/project', commit: 'a'.repeat(40), path: 'view.wxml', platform: 'weapp', profileId: 'weapp-legacy', category: 'native' as const, licenseId: 'MIT', expectation: 'valid' as const }
    const report = runCorpusCases(api, [{ sha256: 'hash', source: '<view/>', origins: [origin, { ...origin, path: 'other.wxml' }, { ...origin, expectation: 'pending' }] }], corpusProfiles)
    expect(report.cases).toBe(2)
    expect(report.entries.default.passed).toBe(1)
    expect(report.pending).toBe(1)
    expect(report.accepted).toBe(false)
  })

  it('reports the unaided and configured resolver entries separately', () => {
    const profile = { ...corpusProfiles[0]!, id: 'resolver-profile', resolver: 'babel' as const }
    const origin = { repository: 'owner/project', commit: 'a'.repeat(40), path: 'view.wxml', platform: 'weapp', profileId: profile.id, category: 'native' as const, licenseId: 'MIT', expectation: 'valid' as const }
    const document = { sha256: 'hash', source: '<wxs>// trailing </wxs>', origins: [origin] }
    const resolver = (source: string) => ({ start: source.lastIndexOf('</wxs>'), end: source.length })
    const report = runCorpusCases(api, [document], [profile], () => resolver)
    expect(report.entries.default.failed).toBe(1)
    expect(report.entries.resolver.passed).toBe(1)
    expect(report.accepted).toBe(true)
    expect(runCorpusCases(api, [document], [profile]).accepted).toBe(false)
  })
})
