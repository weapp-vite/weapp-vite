import type { MatrixTemplateCase } from '../assertions/matrix'
import type { CorpusDocument, CorpusManifest } from '../types'
import type { FrozenExpectedRecipe } from './inputs'
import { expect, it } from 'vitest'
import { corpusHash } from '../integrity'
import { corpusPolicy, corpusProfiles } from '../profiles'
import { profileFixtures, profileGroups } from './fixtures'

const manifest: CorpusManifest = {
  schemaVersion: 1,
  id: 'new-corpus-version',
  contentSha256: 'a'.repeat(64),
  policy: corpusPolicy,
  profiles: corpusProfiles,
  repositories: [],
  licenses: [],
  discovery: [],
  generations: [{ id: 'taro-build', framework: 'taro', version: '4.3.2', target: 'alipay', mode: 'production', status: 'built', evidence: [] }],
  documents: 3,
  origins: 3,
  shards: [],
}

function document(source: string, platform = 'weapp', profileId = 'weapp-legacy'): CorpusDocument {
  return { source, sha256: corpusHash(source), origins: [{ repository: 'example/app', commit: 'b'.repeat(40), path: 'pages/home.wxml', licenseId: 'test-mit', platform, profileId, category: 'native', expectation: 'valid' }] }
}

it('uses a separate corpus denominator and retains all platform/profile/framework memberships', () => {
  const common = document('<view title="&amp;">😀</view>')
  common.origins.push({ ...common.origins[0]!, platform: 'alipay', profileId: 'alipay-xml', category: 'generated', generationId: 'taro-build' })
  const bound = document('<view wx:if="{{yes}}">{{text}}</view>')
  const invalid = document('<view>')
  invalid.origins[0]!.expectation = 'invalid'
  const { fixtures, excluded } = profileFixtures([common, bound, invalid], manifest)
  expect(fixtures).toHaveLength(3)
  expect(excluded).toEqual([{ sha256: invalid.sha256, profileId: 'weapp-legacy', expectation: 'invalid' }])
  expect(fixtures.find(fixture => fixture.profile.platform === 'alipay')!.frameworks).toEqual(['taro@4.3.2'])
  const groups = profileGroups(fixtures)
  expect(groups.find(group => group.id === 'shared-xml/all')!.fixtureIds).toHaveLength(2)
  expect(groups.find(group => group.id === 'platform-specific/all')!.fixtureIds).toHaveLength(1)
  expect(groups.find(group => group.id === 'shared-xml/platform:alipay')!.comparable).toBe(true)
  expect(groups.find(group => group.id === 'platform-specific/feature:bindings')!.comparable).toBe(false)
})

it('classifies shared XML before invoking a parser and keeps non-common syntax in throughput groups', () => {
  const raw = document('<jds module="a">const fake = "<view/>"</jds>', 'jd', 'jd-xml')
  const duplicate = document('<view a="1" a="2"/>')
  const { fixtures } = profileFixtures([raw, duplicate], manifest)
  expect(fixtures.every(fixture => !fixture.comparison.eligible)).toBe(true)
  expect(profileGroups(fixtures).every(group => !group.comparable)).toBe(true)
  expect(fixtures.find(fixture => fixture.profile.platform === 'jd')!.features).toContain('raw-script')
})

it('profiles every controlled generation membership independently of real-source quotas', () => {
  const source = '<view title="&amp;">{{message}}</view>'
  const common = document(source, 'alipay', 'alipay-xml')
  const frozen = { ...manifest, generations: [...manifest.generations, { ...manifest.generations[0]!, id: 'taro-dev', mode: 'development' }] }
  const original = JSON.stringify(frozen)
  const production: MatrixTemplateCase = { source, sha256: corpusHash(source), fixtureId: 'controlled-taro', generationId: 'taro-build', framework: 'taro', version: '4.3.2', target: 'alipay', mode: 'production', path: 'out/production/base.axml', platform: 'alipay', profileId: 'alipay-xml', quotaEligible: false }
  const development = { ...production, generationId: 'taro-dev', mode: 'development', path: 'out/development/base.axml' }
  const { fixtures } = profileFixtures([common], frozen, { matrix: [production, development] })
  expect(fixtures).toHaveLength(2)
  expect(new Set(fixtures.map(fixture => fixture.id)).size).toBe(2)
  const controlled = fixtures.find(fixture => !fixture.quotaEligible)!
  expect(controlled.matrix).toHaveLength(2)
  expect(controlled.frameworks).toEqual(['taro@4.3.2'])
  expect(controlled.categories).toEqual(['controlled-fixture'])
  const groups = profileGroups(fixtures)
  expect(groups.find(group => group.id === 'platform-specific/all')!.fixtureIds).toHaveLength(1)
  expect(groups.find(group => group.id === 'controlled-fixture/platform-specific/all')!.fixtureIds).toHaveLength(1)
  expect(groups.find(group => group.id === 'controlled-fixture/platform-specific/feature:bindings')!.fixtureIds).toEqual([controlled.id])
  expect(JSON.stringify(frozen)).toBe(original)
  expect(() => profileFixtures([], frozen, { matrix: [{ ...production, quotaEligible: true } as unknown as MatrixTemplateCase] })).toThrow('cannot enter real-source quotas')
  expect(() => profileFixtures([], frozen, { matrix: [{ ...production, version: '3.6.40' }] })).toThrow('generation identity changed')
})

it('groups expected templates by explicit frozen snapshot recipes and retains unidentified versions', () => {
  const selected = document('<view/>', 'alipay', 'alipay-xml')
  selected.origins[0] = { ...selected.origins[0]!, category: 'expected', path: 'expected.snap', snapshot: { format: 'jest-files', key: 'alipay build', start: 2, end: 9, section: { path: 'dist/base.axml', start: 2, end: 9 } } }
  const recipe: FrozenExpectedRecipe = { repository: selected.origins[0].repository, commit: selected.origins[0].commit, sourcePath: 'expected.snap', profileId: 'alipay-xml', platform: 'alipay', format: 'jest-files', keys: ['alipay build'], files: ['dist/base.axml'], framework: 'taro', version: '3.6.40' }
  expect(profileFixtures([selected], manifest, { expectedRecipes: [recipe] }).fixtures[0]!.frameworks).toEqual(['taro@3.6.40'])
  expect(profileFixtures([selected], manifest).fixtures[0]!.frameworks).toEqual(['expected:unknown'])
  expect(profileFixtures([selected], manifest, { expectedRecipes: [{ ...recipe, commit: 'c'.repeat(40) }] }).fixtures[0]!.frameworks).toEqual(['expected:unknown'])
  expect(profileFixtures([selected], manifest, { expectedRecipes: [{ ...recipe, files: ['dist/other.axml'] }] }).fixtures[0]!.frameworks).toEqual(['expected:unknown'])
})

it('keeps every invalid and pending controlled identity outside timing without changing its frozen expectation', () => {
  const source = '<input placeholder="" entity ""/>'
  const invalid: MatrixTemplateCase = { source, sha256: corpusHash(source), fixtureId: 'controlled-taro', generationId: 'taro-build', framework: 'taro', version: '4.3.2', target: 'alipay', mode: 'production', path: 'out/production/pages/index/index.axml', platform: 'alipay', profileId: 'alipay-xml', quotaEligible: false, expectation: 'invalid', diagnosticCodes: ['template/invalid-syntax'], evidence: ['frozen-upstream-codegen-review'] }
  const pending = { ...invalid, path: 'out/production/pages/other/index.axml', expectation: 'pending' as const, diagnosticCodes: undefined, evidence: ['independent-review-pending'] }
  const valid = { ...invalid, source: '<view/>', sha256: corpusHash('<view/>'), path: 'out/production/components/card.axml', expectation: undefined, diagnosticCodes: undefined, evidence: undefined }
  const { fixtures, excluded, matrixExpectations } = profileFixtures([], manifest, { matrix: [invalid, pending, valid] })
  expect(fixtures).toHaveLength(1)
  expect(fixtures[0]!.source).toBe('<view/>')
  expect(excluded).toEqual([invalid, pending])
  expect(matrixExpectations).toEqual({ valid: 1, invalid: 1, pending: 1 })
  expect(profileGroups(fixtures).every(group => !group.fixtureIds.includes(`matrix:${invalid.sha256}:alipay-xml`))).toBe(true)
  expect(invalid.expectation).toBe('invalid')
})
