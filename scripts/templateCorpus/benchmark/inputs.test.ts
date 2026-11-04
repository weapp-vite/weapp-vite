import type { CorpusOrigin } from '../types'
import type { FrozenExpectedRecipe } from './inputs'
import { expect, it } from 'vitest'
import { CorpusEvidenceStore } from '../imports/files'
import { corpusPolicy, corpusProfiles } from '../profiles'
import { expectedFramework, extractExpectedRecipes } from './inputs'

const recipe: FrozenExpectedRecipe = { repository: 'example/framework', commit: 'a'.repeat(40), sourcePath: 'tests/templates.snap', profileId: 'alipay-xml', platform: 'alipay', format: 'jest-files', keys: ['alipay output'], files: ['dist/base.axml'], framework: 'taro', version: '4.3.2' }
const origin: CorpusOrigin = { repository: recipe.repository, commit: recipe.commit, path: recipe.sourcePath, profileId: recipe.profileId, platform: recipe.platform, category: 'expected', licenseId: 'confirmed-test-license', expectation: 'valid', snapshot: { format: 'jest-files', key: 'alipay output', start: 3, end: 20, section: { path: 'dist/base.axml', start: 3, end: 20 } } }

function frozen(configuration: unknown) {
  const store = new CorpusEvidenceStore()
  const reference = store.json(`sources/${recipe.repository}/${recipe.commit}/references.json`, 'report', { schemaVersion: 1, kind: 'source', repository: recipe.repository, commit: recipe.commit, configuration: store.object(JSON.stringify(configuration)) })
  const manifest = { schemaVersion: 1 as const, id: 'profile-input-test', contentSha256: 'b'.repeat(64), documents: 0, origins: 0, profiles: corpusProfiles, policy: corpusPolicy, licenses: [], discovery: [], generations: [], shards: [], repositories: [{ repository: recipe.repository, commit: recipe.commit, independentRepository: recipe.repository, licenseId: 'confirmed-test-license', treeSha256: 'c'.repeat(64), treeFiles: 0, selectedFiles: 0, excludedFiles: 0, complete: true, evidence: [reference] }] }
  return { manifest, resources: store.resources() }
}

it('reads framework identity only from frozen source configuration CAS objects', () => {
  const selected = frozen({ expectedRecipes: [recipe] })
  expect(extractExpectedRecipes(selected.manifest, selected.resources)).toEqual([recipe])
  const nested = frozen({ configuration: { expectedRecipes: [recipe] } })
  expect(extractExpectedRecipes(nested.manifest, nested.resources)).toEqual([recipe])
  expect(extractExpectedRecipes(frozen({}).manifest, frozen({}).resources)).toEqual([])
  const changed = selected.resources.map(resource => resource.file === selected.manifest.repositories[0]!.evidence[0]!.file ? { ...resource, content: '{}' } : resource)
  expect(() => extractExpectedRecipes(selected.manifest, changed)).toThrow('changed frozen expected performance metadata')
  const mismatched = frozen({ expectedRecipes: [{ ...recipe, commit: 'd'.repeat(40) }] })
  expect(() => extractExpectedRecipes(mismatched.manifest, mismatched.resources)).toThrow('recipe commit mismatch')
  const unpinned = frozen({ expectedRecipes: [{ ...recipe, version: 'latest' }] })
  expect(() => extractExpectedRecipes(unpinned.manifest, unpinned.resources)).toThrow('version is not pinned')
})

it('requires matching snapshot context and reports missing or conflicting identities as unknown', () => {
  expect(expectedFramework(origin, [recipe])).toBe('taro@4.3.2')
  expect(expectedFramework({ ...origin, snapshot: undefined }, [recipe])).toBe('expected:unknown')
  for (const changed of [{ ...recipe, sourcePath: 'other.snap' }, { ...recipe, profileId: 'weapp-legacy' }, { ...recipe, platform: 'weapp' }, { ...recipe, keys: ['other key'] }, { ...recipe, format: 'jest' as const }, { ...recipe, files: undefined }]) {
    expect(expectedFramework(origin, [changed])).toBe('expected:unknown')
  }
  expect(expectedFramework(origin, [recipe, { ...recipe, version: '3.6.40' }])).toBe('expected:unknown')
})
