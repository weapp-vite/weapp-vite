import type { CorpusFileIdentity, CorpusLicense, CorpusRepository, CorpusTextFile } from '../types'
import type { NativeEvidenceSource } from './native'
import assert from 'node:assert/strict'
import { corpusHash, corpusJson } from '../integrity'

function sorted<T>(entries: Map<string, T>): T[] {
  return [...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value)
}

function mergeTextFiles<T extends CorpusTextFile>(files: readonly T[], label: string, key: (file: T) => string = file => file.path): T[] {
  const paths = new Map<string, CorpusTextFile>()
  const entries = new Map<string, T>()
  for (const file of files) {
    assert.equal(corpusHash(file.text), file.sha256, `${label} content hash mismatch: ${file.path}`)
    const previousPath = paths.get(file.path)
    assert.ok(!previousPath || (previousPath.sha256 === file.sha256 && previousPath.text === file.text), `Conflicting ${label} content: ${file.path}`)
    paths.set(file.path, file)
    const identity = key(file)
    const previous = entries.get(identity)
    assert.ok(!previous || corpusJson(previous) === corpusJson(file), `Conflicting ${label} identity: ${file.path}`)
    entries.set(identity, { ...file })
  }
  return sorted(entries)
}

function mergeFileIdentities(files: readonly CorpusFileIdentity[]): CorpusFileIdentity[] {
  const entries = new Map<string, CorpusFileIdentity>()
  for (const file of files) {
    const previous = entries.get(file.file)
    assert.ok(!previous || corpusJson(previous) === corpusJson(file), `Conflicting repository evidence: ${file.file}`)
    entries.set(file.file, { ...file })
  }
  return sorted(entries)
}

/** 零计数输入视图不能覆盖原生采集；相互矛盾的非零视图必须由维护入口先完整合并。 */
export function mergeCorpusRepositories(repositories: readonly CorpusRepository[]): CorpusRepository[] {
  const entries = new Map<string, CorpusRepository>()
  for (const repository of repositories) {
    const key = `${repository.repository}@${repository.commit}`
    assert.ok([repository.treeFiles, repository.selectedFiles, repository.excludedFiles].every(count => Number.isSafeInteger(count) && count >= 0), `Invalid repository file counts: ${key}`)
    assert.equal(typeof repository.complete, 'boolean', `Invalid repository completeness: ${key}`)
    const previous = entries.get(key)
    if (previous) {
      for (const field of ['treeSha256', 'treeFiles', 'licenseId', 'independentRepository'] as const) {
        assert.equal(repository[field], previous[field], `Conflicting repository ${field}: ${key}`)
      }
      const previousCounted = previous.selectedFiles !== 0 || previous.excludedFiles !== 0
      const currentCounted = repository.selectedFiles !== 0 || repository.excludedFiles !== 0
      assert.ok(!previousCounted || !currentCounted || (previous.selectedFiles === repository.selectedFiles && previous.excludedFiles === repository.excludedFiles), `Conflicting nonzero repository selection counts: ${key}; merge the complete collection before import`)
      const counts = previousCounted ? previous : repository
      entries.set(key, {
        ...previous,
        selectedFiles: counts.selectedFiles,
        excludedFiles: counts.excludedFiles,
        complete: previous.complete && repository.complete,
        identityEvidence: mergeTextFiles([...(previous.identityEvidence ?? []), ...(repository.identityEvidence ?? [])], 'repository identity evidence'),
        evidence: mergeFileIdentities([...(previous.evidence ?? []), ...(repository.evidence ?? [])]),
      })
    }
    else {
      entries.set(key, {
        ...repository,
        identityEvidence: mergeTextFiles(repository.identityEvidence ?? [], 'repository identity evidence'),
        evidence: mergeFileIdentities(repository.evidence ?? []),
      })
    }
  }
  return sorted(entries)
}

/** 同一许可 ID 必须完整指向同一归属身份和原文，不允许后写覆盖或补猜授权。 */
export function mergeCorpusLicenses(licenses: readonly CorpusLicense[]): CorpusLicense[] {
  const entries = new Map<string, CorpusLicense>()
  for (const license of licenses) {
    const files = new Map(license.files.map(file => [file.path, file]))
    assert.equal(files.size, license.files.length, `Duplicate license file path: ${license.id}`)
    const normalized = { ...license, files: sorted(files).map(file => ({ ...file })) }
    const previous = entries.get(license.id)
    assert.ok(!previous || corpusJson(previous) === corpusJson(normalized), `Conflicting license identity or content: ${license.id}`)
    entries.set(license.id, normalized)
  }
  return sorted(entries)
}

/** 重复来源仅合并相同冻结配置的证据；不同选择或输入投影必须预先完整合并。 */
export function mergeNativeEvidenceSources(sources: readonly NativeEvidenceSource[]): NativeEvidenceSource[] {
  const entries = new Map<string, NativeEvidenceSource>()
  for (const source of sources) {
    const key = `${source.repository}@${source.commit}`
    const previous = entries.get(key)
    assert.ok(!previous || corpusJson(previous.tree) === corpusJson(source.tree), `Conflicting native source tree: ${key}`)
    assert.ok(!previous || corpusJson(previous.configuration) === corpusJson(source.configuration), `Conflicting native source configuration: ${key}; pre-merge the complete selections and input projections before collection`)
    entries.set(key, {
      ...source,
      containers: mergeTextFiles([...(previous?.containers ?? []), ...(source.containers ?? [])], 'source container'),
      snapshots: mergeTextFiles([...(previous?.snapshots ?? []), ...(source.snapshots ?? [])], 'source snapshot', snapshot => `${snapshot.path}:${snapshot.format}:${corpusJson(snapshot.files ?? null)}`),
    })
  }
  return sorted(entries)
}
