import type { GitTreeEntry } from '../collect/github'
import type { CorpusRepository, CorpusTextFile } from '../types'
import type { SourceReferenceIndex } from './types'
import assert from 'node:assert/strict'
import { extractContainerTemplate } from '../collect/container'
import { extractStaticSnapshots } from '../generate/expected'
import { corpusHash, corpusJson } from '../integrity'
import { CorpusEvidenceStore } from './files'

export interface NativeEvidenceSource {
  repository: string
  commit: string
  tree: readonly GitTreeEntry[]
  configuration: unknown
  containers?: readonly CorpusTextFile[]
  snapshots?: readonly (CorpusTextFile & { format: 'jest' | 'literal' | 'jest-files', files?: readonly string[] })[]
}

export function sourceConfigurationIdentity(configuration: unknown): { repository: string, commit: string } {
  assert.ok(configuration && typeof configuration === 'object', 'Missing frozen source configuration')
  const nested = 'configuration' in configuration && configuration.configuration && typeof configuration.configuration === 'object' ? configuration.configuration : configuration
  const source = 'source' in nested ? nested.source : nested
  assert.ok(source && typeof source === 'object' && 'repository' in source && typeof source.repository === 'string' && 'commit' in source && typeof source.commit === 'string', 'Source configuration has no frozen identity')
  return { repository: source.repository, commit: source.commit }
}

/** 由调用方传入已取得的完整树，冻结阶段不联网或重新发现分支。 */
export function freezeNativeEvidence(options: { repositories: readonly CorpusRepository[], sources: readonly NativeEvidenceSource[], discovery: unknown }) {
  const store = new CorpusEvidenceStore()
  const sources = new Map(options.sources.map(source => [`${source.repository}@${source.commit}`, source]))
  assert.equal(sources.size, options.sources.length, 'Duplicate native evidence source')
  const discovery = store.object(corpusJson(options.discovery))
  const repositories = options.repositories.map((repository) => {
    const source = sources.get(`${repository.repository}@${repository.commit}`)
    assert.ok(source, 'Missing complete tree/configuration for imported collection')
    assert.equal(source.tree.length, repository.treeFiles, 'Frozen source tree file count mismatch')
    assert.equal(corpusHash(corpusJson(source.tree)), repository.treeSha256, 'Frozen source tree hash mismatch')
    assert.equal(corpusJson(sourceConfigurationIdentity(source.configuration)), corpusJson({ repository: repository.repository, commit: repository.commit }), 'Frozen selection/source identity mismatch')
    const reference: SourceReferenceIndex = {
      schemaVersion: 1,
      kind: 'source',
      repository: repository.repository,
      commit: repository.commit,
      tree: store.object(corpusJson(source.tree)),
      configuration: store.object(corpusJson(source.configuration)),
      discovery,
      containers: (source.containers ?? []).map((container) => {
        assert.equal(corpusHash(container.text), container.sha256, 'Frozen source container hash mismatch')
        const extracted = extractContainerTemplate(container.text)
        return { path: container.path, object: store.object(container.text), start: extracted.start, end: extracted.end }
      }),
      snapshots: (source.snapshots ?? []).map((snapshot) => {
        assert.equal(corpusHash(snapshot.text), snapshot.sha256, 'Frozen upstream snapshot hash mismatch')
        assert.ok(['jest', 'literal', 'jest-files'].includes(snapshot.format), 'Invalid frozen upstream snapshot format')
        return { path: snapshot.path, format: snapshot.format, files: snapshot.files, object: store.object(snapshot.text), extraction: store.object(corpusJson(extractStaticSnapshots(snapshot.text, snapshot.format, snapshot.files))) }
      }),
    }
    const evidence = store.json(`sources/${repository.repository}/${repository.commit}/references.json`, 'report', reference)
    return { ...repository, evidence: [evidence] }
  })
  return { repositories, resources: store.resources() }
}
