import type { MatrixTemplateCase } from '../assertions/matrix'
import type { CorpusEvidenceResource } from '../evidence'
import type { SourceReferenceIndex } from '../imports/types'
import type { CorpusDocument, CorpusFileIdentity, CorpusManifest, CorpusOrigin } from '../types'
import assert from 'node:assert/strict'
import { readCorpusEvidence } from '../evidence'
import { assertIdentity, parseEvidenceJson } from '../imports/files'
import { validateFrozenReferences } from '../imports/verify'
import { corpusHash } from '../integrity'
import { extractMatrixCases } from '../test/matrix'

export interface FrozenExpectedRecipe {
  repository: string
  commit: string
  sourcePath: string
  profileId: string
  platform: string
  format: 'jest' | 'literal' | 'jest-files'
  keys: string[]
  files?: string[]
  framework: string
  version: string
}

export interface ProfileInputs {
  matrix: MatrixTemplateCase[]
  expectedRecipes: FrozenExpectedRecipe[]
}

function expectedRecipe(value: unknown, repository: string, commit: string): FrozenExpectedRecipe {
  assert.ok(value && typeof value === 'object', 'Invalid frozen expected performance recipe')
  const recipe = value as FrozenExpectedRecipe
  assert.equal(recipe.repository, repository, 'Frozen expected recipe repository mismatch')
  assert.equal(recipe.commit, commit, 'Frozen expected recipe commit mismatch')
  for (const field of ['sourcePath', 'profileId', 'platform', 'framework', 'version'] as const) {
    assert.ok(typeof recipe[field] === 'string' && recipe[field], `Missing frozen expected recipe ${field}`)
  }
  assert.ok(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(recipe.version), 'Expected performance framework version is not pinned')
  assert.ok(['jest', 'literal', 'jest-files'].includes(recipe.format), 'Invalid frozen expected snapshot format')
  assert.ok(Array.isArray(recipe.keys) && recipe.keys.length && recipe.keys.every(key => typeof key === 'string' && key), 'Missing frozen expected snapshot keys')
  assert.ok(recipe.files === undefined || (Array.isArray(recipe.files) && recipe.files.length && recipe.files.every(file => typeof file === 'string' && file)), 'Invalid frozen expected snapshot sections')
  return recipe
}

/** 只信任已冻结 CAS 配置中的完整 recipe 身份，不从文件名或仓库名推断框架版本。 */
export function extractExpectedRecipes(manifest: CorpusManifest, resources: readonly CorpusEvidenceResource[]): FrozenExpectedRecipe[] {
  const files = new Map(resources.map(resource => [resource.file, typeof resource.content === 'string' ? new TextEncoder().encode(resource.content) : resource.content]))
  const object = (identity: CorpusFileIdentity, cas = false) => {
    assertIdentity(identity)
    if (cas) {
      assert.equal(identity.file, `objects/${identity.sha256}`, 'Expected performance CAS label changed')
    }
    const bytes = files.get(identity.file)
    assert.ok(bytes && bytes.length === identity.bytes && corpusHash(bytes) === identity.sha256, 'Missing or changed frozen expected performance metadata')
    return bytes
  }
  const result: FrozenExpectedRecipe[] = []
  for (const repository of manifest.repositories) {
    assert.ok(repository.evidence?.length === 1, 'Missing frozen source performance metadata')
    const identity = repository.evidence[0]!
    assert.equal(identity.file, `sources/${repository.repository}/${repository.commit}/references.json`, 'Expected performance source reference label changed')
    const reference = parseEvidenceJson(object(identity)) as SourceReferenceIndex
    assert.ok(reference?.schemaVersion === 1 && reference.kind === 'source' && reference.repository === repository.repository && reference.commit === repository.commit, 'Invalid frozen source performance reference')
    const configuration = parseEvidenceJson(object(reference.configuration, true))
    assert.ok(configuration && typeof configuration === 'object', 'Invalid frozen expected source configuration')
    const nested = 'configuration' in configuration && configuration.configuration && typeof configuration.configuration === 'object' ? configuration.configuration : configuration
    if ('expectedRecipes' in nested) {
      assert.ok(Array.isArray(nested.expectedRecipes), 'Invalid frozen expected recipe inventory')
      result.push(...nested.expectedRecipes.map(value => expectedRecipe(value, repository.repository, repository.commit)))
    }
  }
  return result
}

/** 使用 snapshot 原始身份及显式 section 白名单匹配；无唯一证据时保留 unknown。 */
export function expectedFramework(origin: CorpusOrigin, recipes: readonly FrozenExpectedRecipe[]): string {
  const snapshot = origin.snapshot
  if (!snapshot) {
    return 'expected:unknown'
  }
  const matches = recipes.filter(recipe => recipe.repository === origin.repository && recipe.commit === origin.commit
    && recipe.sourcePath === origin.path && recipe.profileId === origin.profileId && recipe.platform === origin.platform
    && recipe.format === snapshot.format && recipe.keys.includes(snapshot.key)
    && (recipe.files ? Boolean(snapshot.section && recipe.files.includes(snapshot.section.path)) : !snapshot.section))
  const identities = new Set(matches.map(recipe => `${recipe.framework}@${recipe.version}`))
  return identities.size === 1 ? [...identities][0]! : 'expected:unknown'
}

/** 真实来源和受控矩阵共用完整冻结证据，后者始终保留非配额身份。 */
export async function readProfileInputs(directory: string, manifest: CorpusManifest, documents: readonly CorpusDocument[]): Promise<ProfileInputs> {
  const resources = await readCorpusEvidence(directory, manifest.evidence ?? [])
  validateFrozenReferences(manifest, documents, resources)
  return { matrix: extractMatrixCases(manifest, resources), expectedRecipes: extractExpectedRecipes(manifest, resources) }
}
