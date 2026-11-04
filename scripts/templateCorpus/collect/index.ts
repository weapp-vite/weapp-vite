import type { CorpusCollectionResult, CorpusDocument, CorpusProfile, CorpusSource } from '../types'
import type { GitHubClient, GitHubTransport, GitTreeEntry } from './github'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { corpusHash, corpusJson, mergeCorpusDocuments } from '../archive'
import { resolveTemplateLicense } from '../license'
import { corpusProfiles, getCorpusProfile } from '../profiles'
import { collectSourceAttribution, decodeCorpusSource, mapCorpusFiles } from './attribution'
import { findContainerTemplate } from './container'
import { createGitHubClient, readCompleteTree } from './github'
import { confirmTemplateIdentity, identityEvidencePaths } from './identity'
import { matchesSelection, suspiciousExtension, validateSource } from './selection'

export { collectSourceAttribution, isAttributionFile } from './attribution'

const collectorSchemaVersion = 5

export interface CollectSourcesOptions {
  cacheDir: string
  outputDir?: string
  profiles?: readonly CorpusProfile[]
  client?: GitHubClient
  transport?: GitHubTransport
  concurrency?: number
  onProgress?: (repository: string, files: number) => void
}

async function collectSource(source: CorpusSource, options: CollectSourcesOptions, client: GitHubClient): Promise<CorpusCollectionResult> {
  const profiles = options.profiles ?? corpusProfiles
  const selectionHash = corpusHash(corpusJson({ collectorSchemaVersion, source, profiles }))
  const checkpoint = path.join(options.cacheDir, 'repositories', `${selectionHash}.json`)
  try {
    const value: unknown = JSON.parse(await readFile(checkpoint, 'utf8'))
    assert.ok(value && typeof value === 'object' && 'result' in value && 'sha256' in value, 'Invalid corpus collection checkpoint')
    assert.equal(corpusHash(corpusJson(value.result)), value.sha256, 'Corrupt corpus collection checkpoint')
    const result = value.result as CorpusCollectionResult
    mergeCorpusDocuments(result.documents)
    return result
  }
  catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error
    }
  }
  const files = await readCompleteTree(client, source.repository, source.commit)
  validateSource(source, files)
  const byPath = new Map(files.map(file => [file.path, file]))
  for (const selection of source.selections) {
    assert.equal(getCorpusProfile(selection.profileId, profiles).platform, selection.platform, 'Corpus selection/profile mismatch')
  }
  const license = await collectSourceAttribution(source, files, client, options.concurrency)
  const licenseId = license.id
  const identityEvidence = await mapCorpusFiles(identityEvidencePaths(source.selections, files), options.concurrency ?? 8, async (file) => {
    const text = decodeCorpusSource(await client.blob(source.repository, source.commit, byPath.get(file)!), `${source.repository}@${source.commit}:${file}`)
    return { path: file, text, sha256: corpusHash(text) }
  })
  const candidates = files.filter(file => source.selections.some(selection => matchesSelection(file.path, selection)))
  const excluded: CorpusCollectionResult['excluded'] = []
  const downloaded = await mapCorpusFiles(candidates, options.concurrency ?? 8, async (file: GitTreeEntry): Promise<CorpusDocument | undefined> => {
    if (file.mode === '120000') {
      excluded.push({ repository: source.repository, commit: source.commit, path: file.path, reason: 'git-symbolic-link-is-not-a-template' })
      return undefined
    }
    const grant = resolveTemplateLicense(file.path, license)
    if (!grant.confirmed) {
      excluded.push({ repository: source.repository, commit: source.commit, path: file.path, reason: grant.reason!, evidence: grant.evidence })
      return undefined
    }
    const raw = decodeCorpusSource(await client.blob(source.repository, source.commit, file), `${source.repository}@${source.commit}:${file.path}`)
    const selections = source.selections.filter(selection => matchesSelection(file.path, selection)).flatMap((selection) => {
      const identity = confirmTemplateIdentity(selection, file.path, raw, files, identityEvidence)
      if (!identity.confirmed) {
        excluded.push({ repository: source.repository, commit: source.commit, path: file.path, platform: selection.platform, profileId: selection.profileId, evidence: identity.evidence, reason: 'platform-identity-unconfirmed' })
        return []
      }
      return [{ ...selection, evidence: [...selection.evidence, ...identity.evidence] }]
    })
    if (!selections.length) {
      return undefined
    }
    const confirmedProject = selections.some(selection => selection.evidence.some(item => item.startsWith('platform-config:') || item.startsWith('platform-declaration:')))
    const reason = suspiciousExtension(file.path, raw, files, confirmedProject)
    if (reason) {
      excluded.push({ repository: source.repository, commit: source.commit, path: file.path, reason })
      return undefined
    }
    const isContainer = /\.ux$/i.test(file.path)
    const container = isContainer ? findContainerTemplate(raw) : undefined
    if (isContainer && !container) {
      excluded.push(...selections.map(selection => ({
        repository: source.repository,
        commit: source.commit,
        path: file.path,
        platform: selection.platform,
        profileId: selection.profileId,
        reason: 'no-explicit-template',
        evidence: [...selection.evidence, `container-sha256:${corpusHash(raw)}`],
      })))
      return undefined
    }
    const template = container?.source ?? raw
    return {
      source: template,
      sha256: corpusHash(template),
      origins: selections.map(selection => ({
        repository: source.repository,
        commit: source.commit,
        path: file.path,
        platform: selection.platform,
        profileId: selection.profileId,
        category: selection.category ?? 'native',
        expectation: selection.expectation ?? 'valid',
        diagnosticCodes: selection.diagnosticCodes,
        licenseId,
        licensePath: grant.path,
        licenseSpdx: grant.spdx,
        evidence: [...selection.evidence, ...grant.evidence, ...(container ? [`container-sha256:${corpusHash(raw)}`, `container-template-utf16:${container.start}:${container.end}`] : [])],
      })),
    }
  })
  const documents = mergeCorpusDocuments(downloaded.filter((document): document is CorpusDocument => Boolean(document)))
  const result: CorpusCollectionResult = {
    documents,
    licenses: [license],
    repositories: [{
      repository: source.repository,
      commit: source.commit,
      independentRepository: source.independentRepository ?? source.repository,
      licenseId,
      treeSha256: corpusHash(corpusJson(files)),
      treeFiles: files.length,
      selectedFiles: downloaded.filter(Boolean).length,
      excludedFiles: new Set(excluded.map(file => file.path)).size,
      complete: true,
      identityEvidence,
    }],
    excluded: excluded.sort((a, b) => a.path.localeCompare(b.path, 'en')),
  }
  await mkdir(path.dirname(checkpoint), { recursive: true })
  const pendingCheckpoint = `${checkpoint}.${randomUUID()}.partial`
  await writeFile(pendingCheckpoint, `${corpusJson({ result, sha256: corpusHash(corpusJson(result)) })}\n`)
  await rename(pendingCheckpoint, checkpoint)
  options.onProgress?.(source.repository, result.repositories[0]!.selectedFiles)
  return result
}

/** 对冻结来源逐仓库提交检查点；出错时保留已完成来源，重跑不会重复下载。 */
export async function collectSources(sources: readonly CorpusSource[], options: CollectSourcesOptions): Promise<CorpusCollectionResult> {
  assert.ok(Number.isSafeInteger(options.concurrency ?? 8) && (options.concurrency ?? 8) > 0, 'Invalid collector concurrency')
  const client = options.client ?? createGitHubClient({ cacheDir: options.cacheDir, transport: options.transport })
  const results: CorpusCollectionResult[] = []
  for (const source of sources) {
    results.push(await collectSource(source, options, client))
  }
  const combined: CorpusCollectionResult = {
    documents: mergeCorpusDocuments(results.flatMap(result => result.documents)),
    licenses: [...new Map(results.flatMap(result => result.licenses).map(license => [license.id, license])).values()],
    repositories: results.flatMap(result => result.repositories),
    excluded: results.flatMap(result => result.excluded),
  }
  if (options.outputDir) {
    await mkdir(options.outputDir, { recursive: true })
    await writeFile(path.join(options.outputDir, 'collection.json'), `${corpusJson(combined)}\n`)
  }
  return combined
}
