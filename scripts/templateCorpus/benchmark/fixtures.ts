import type { MatrixTemplateCase } from '../assertions/matrix'
import type { CorpusDocument, CorpusExpectation, CorpusManifest, CorpusProfile } from '../types'
import type { FrozenExpectedRecipe } from './inputs'
import type { ProfileFixture, ProfileGroup } from './types'
import assert from 'node:assert/strict'
import { classifyXmlSubset } from '../assertions/xmlSubset'
import { corpusHash } from '../integrity'
import { expectedFramework } from './inputs'

function hasNonAscii(source: string): boolean {
  for (let index = 0; index < source.length; index++) {
    if (source.charCodeAt(index) > 127) {
      return true
    }
  }
  return false
}

function features(source: string, rawTags: readonly string[]): string[] {
  return [
    ['bindings', source.includes('{{')],
    ['entities', /&(?:\w+|#\d+|#x[\da-f]+);/i.test(source)],
    ['attributes', /<[\w:.-]+\s[^>]*=/.test(source)],
    ['comments', source.includes('<!--')],
    ['cdata', source.includes('<![CDATA[')],
    ['unicode', hasNonAscii(source)],
    ['crlf', source.includes('\r\n')],
    ['raw-script', rawTags.some(tag => new RegExp(`<${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s/>])`, 'i').test(source))],
  ].flatMap(([name, present]) => present ? [name as string] : [])
}

function createFixture(source: string, sha256: string, profile: CorpusProfile, quotaEligible: boolean, frameworks: string[], categories: string[]): ProfileFixture {
  const options = { platform: profile.parserPlatform, syntax: profile.syntax, rawTags: profile.rawTags }
  const bytes = new TextEncoder().encode(source).length
  return {
    id: `${quotaEligible ? '' : 'matrix:'}${sha256}:${profile.id}`,
    sha256,
    source,
    bytes,
    profile,
    options,
    size: bytes <= 1024 ? 'small' : bytes <= 10_240 ? 'medium' : 'large',
    features: features(source, profile.rawTags),
    comparison: classifyXmlSubset(source, options),
    frameworks: [...new Set(frameworks)].sort(),
    categories: [...new Set(categories)].sort(),
    quotaEligible,
  }
}

/** 同内容同 profile 仅在各自来源类别内计时一次，受控产物不改变真实语料分母。 */
export function profileFixtures(documents: readonly CorpusDocument[], manifest: CorpusManifest, inputs: { matrix?: readonly MatrixTemplateCase[], expectedRecipes?: readonly FrozenExpectedRecipe[] } = {}) {
  const profiles = new Map(manifest.profiles.map(profile => [profile.id, profile]))
  const generations = new Map(manifest.generations.map(generation => [generation.id, generation]))
  const fixtures: ProfileFixture[] = []
  const excluded: Array<{ sha256: string, profileId: string, expectation: CorpusExpectation } & Partial<MatrixTemplateCase>> = []
  const matrixExpectations = { valid: 0, invalid: 0, pending: 0 }
  for (const document of documents) {
    for (const profileId of new Set(document.origins.map(origin => origin.profileId))) {
      const origins = document.origins.filter(origin => origin.profileId === profileId)
      if (!origins.every(origin => origin.expectation === 'valid')) {
        excluded.push(...origins.filter(origin => origin.expectation !== 'valid').map(origin => ({ sha256: document.sha256, profileId, expectation: origin.expectation })))
        continue
      }
      const profile = profiles.get(profileId)
      if (!profile) {
        throw new Error(`Unknown frozen performance profile: ${profileId}`)
      }
      const frameworks = origins.map((origin) => {
        if (origin.category === 'expected') {
          return expectedFramework(origin, inputs.expectedRecipes ?? [])
        }
        const generation = origin.generationId && generations.get(origin.generationId)
        return generation ? `${generation.framework}@${generation.version}` : origin.category
      })
      fixtures.push(createFixture(document.source, document.sha256, profile, true, frameworks, origins.map(origin => origin.category)))
    }
  }
  const matrix = new Map<string, ProfileFixture>()
  for (const template of inputs.matrix ?? []) {
    assert.equal(template.quotaEligible, false, 'Controlled performance inputs cannot enter real-source quotas')
    assert.equal(corpusHash(template.source), template.sha256, 'Controlled performance source hash changed')
    const profile = profiles.get(template.profileId)
    assert.ok(profile && profile.platform === template.platform, 'Missing or mismatched controlled performance profile')
    const generation = generations.get(template.generationId)
    assert.ok(generation?.status === 'built' && generation.framework === template.framework && generation.version === template.version && generation.target === template.target && generation.mode === template.mode, 'Controlled performance generation identity changed')
    const expectation = template.expectation ?? 'valid'
    assert.ok(['valid', 'invalid', 'pending'].includes(expectation), 'Unknown controlled performance expectation')
    matrixExpectations[expectation]++
    if (expectation !== 'valid') {
      excluded.push({ ...template, expectation })
      continue
    }
    const key = `${template.sha256}:${template.profileId}`
    const fixture = matrix.get(key) ?? createFixture(template.source, template.sha256, profile, false, [], ['controlled-fixture'])
    assert.equal(fixture.source, template.source, 'Controlled performance content hash collision')
    fixture.frameworks = [...new Set([...fixture.frameworks, `${template.framework}@${template.version}`])].sort()
    ;(fixture.matrix ??= []).push({ fixtureId: template.fixtureId, generationId: template.generationId, target: template.target, mode: template.mode, path: template.path })
    matrix.set(key, fixture)
  }
  fixtures.push(...matrix.values())
  return { fixtures: fixtures.sort((a, b) => a.id.localeCompare(b.id, 'en')), excluded, matrixExpectations }
}

/** 公共 XML 与平台特有输入各自保留整套和交叉分类，不混合成虚假速度比。 */
export function profileGroups(fixtures: readonly ProfileFixture[]): ProfileGroup[] {
  const groups = new Map<string, ProfileGroup>()
  for (const fixture of fixtures) {
    const prefix = `${fixture.quotaEligible ? '' : 'controlled-fixture/'}${fixture.comparison.eligible ? 'shared-xml' : 'platform-specific'}`
    const labels = ['all', `platform:${fixture.profile.platform}`, `profile:${fixture.profile.id}`, `syntax:${fixture.profile.syntax}`, `size:${fixture.size}`, ...fixture.categories.map(category => `category:${category}`), ...fixture.frameworks.map(framework => `framework:${framework}`), ...fixture.features.map(feature => `feature:${feature}`)]
    for (const label of labels) {
      const id = `${prefix}/${label}`
      const group = groups.get(id) ?? { id, comparable: fixture.comparison.eligible, fixtureIds: [] }
      group.fixtureIds.push(fixture.id)
      groups.set(id, group)
    }
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'))
}
