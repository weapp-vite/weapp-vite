import type { CorpusDocument, CorpusManifest, CorpusMetadata, CorpusOrigin } from './types'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { cleanPreviousArchiveFiles, previousArchiveFiles } from './archiveOwnership'
import { readCorpusEvidence } from './evidence'
import { validateFrozenReferences } from './imports/verify'
import { corpusHash, corpusJson } from './integrity'
import { licenseFileBytes, resolveTemplateLicense } from './license'

export { corpusHash, corpusJson } from './integrity'

function originKey(origin: CorpusOrigin): string {
  return corpusJson(origin)
}

/** 同一份原文只保存一次，不丢弃不同平台、方言或预期的来源。 */
export function mergeCorpusDocuments(documents: readonly CorpusDocument[]): CorpusDocument[] {
  const selected = new Map<string, CorpusDocument>()
  for (const document of documents) {
    assert.equal(document.sha256, corpusHash(document.source), 'Corpus source hash mismatch')
    const previous = selected.get(document.sha256)
    if (previous) {
      assert.equal(previous.source, document.source, 'Corpus content hash collision')
      previous.origins.push(...document.origins)
    }
    else {
      selected.set(document.sha256, { ...document, origins: [...document.origins] })
    }
  }
  return [...selected.values()].sort((a, b) => a.sha256.localeCompare(b.sha256, 'en')).map(document => ({
    ...document,
    origins: [...new Map(document.origins.map(origin => [originKey(origin), origin])).entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, origin]) => origin),
  }))
}

function validateReferences(documents: CorpusDocument[], metadata: CorpusMetadata) {
  const profiles = new Map(metadata.profiles.map(profile => [profile.id, profile]))
  const licenses = new Map(metadata.licenses.map(license => [license.id, license]))
  const generations = new Map(metadata.generations.map(generation => [generation.id, generation]))
  const repositories = new Map(metadata.repositories.map(repository => [`${repository.repository}@${repository.commit}`, repository]))
  assert.equal(profiles.size, metadata.profiles.length, 'Duplicate corpus profile')
  assert.equal(licenses.size, metadata.licenses.length, 'Duplicate corpus license')
  assert.equal(generations.size, metadata.generations.length, 'Duplicate corpus generation')
  assert.equal(repositories.size, metadata.repositories.length, 'Duplicate corpus repository commit')
  for (const generation of generations.values()) {
    if (generation.status === 'built') {
      assert.ok(generation.evidence.length, 'Built corpus generation needs frozen artifact evidence')
    }
    for (const file of generation.evidence) {
      assert.ok(file.file && !file.file.startsWith('/') && !file.file.includes('\\') && !file.file.split('/').includes('..'), 'Nonportable corpus build evidence path')
      assert.ok(/^[\da-f]{64}$/.test(file.sha256) && Number.isSafeInteger(file.bytes) && file.bytes >= 0, 'Invalid corpus build evidence identity')
    }
  }
  for (const repository of repositories.values()) {
    for (const file of repository.identityEvidence ?? []) {
      assert.equal(corpusHash(file.text), file.sha256, 'Platform identity evidence hash mismatch')
    }
  }
  for (const license of licenses.values()) {
    assert.ok(license.spdx && !['NOASSERTION', 'NONE'].includes(license.spdx), 'Unconfirmed corpus license')
    assert.ok(license.files.length, 'Missing license attribution')
    for (const file of license.files) {
      licenseFileBytes(file)
    }
  }
  for (const document of documents) {
    assert.ok(document.origins.length, 'Corpus document without an origin')
    for (const origin of document.origins) {
      assert.ok(/^[\w.-]+\/[\w.-]+$/.test(origin.repository), 'Invalid corpus repository')
      assert.ok(/^[\da-f]{40}$/.test(origin.commit), 'Unfrozen corpus source commit')
      assert.ok(origin.path && !origin.path.includes('\\') && !origin.path.split('/').includes('..') && !origin.path.startsWith('/'), 'Nonportable corpus source path')
      assert.equal(profiles.get(origin.profileId)?.platform, origin.platform, 'Corpus source/profile platform mismatch')
      const license = licenses.get(origin.licenseId)
      assert.ok(license, 'Missing corpus source license')
      assert.equal(license.repository, origin.repository, 'Corpus source/license repository mismatch')
      assert.equal(license.commit, origin.commit, 'Corpus source/license commit mismatch')
      const grant = resolveTemplateLicense(origin.path, license)
      assert.ok(grant.confirmed, `Corpus template license scope is unconfirmed: ${origin.path} (${grant.reason})`)
      if (origin.licensePath) {
        assert.equal(origin.licensePath, grant.path, 'Corpus template license grant path mismatch')
      }
      if (origin.licenseSpdx) {
        assert.equal(origin.licenseSpdx, grant.spdx, 'Corpus template license SPDX mismatch')
      }
      const repository = repositories.get(`${origin.repository}@${origin.commit}`)
      assert.ok(repository?.complete, 'Corpus source without a complete frozen repository')
      assert.equal(repository.licenseId, origin.licenseId, 'Corpus repository/license mismatch')
      assert.ok(['native', 'expected', 'generated'].includes(origin.category), 'Unknown corpus source category')
      assert.ok(['valid', 'invalid', 'pending'].includes(origin.expectation), 'Unknown corpus expectation')
      if (origin.expectation === 'invalid') {
        assert.ok(origin.diagnosticCodes?.length, 'Invalid corpus source needs explicit diagnostic expectations')
      }
      if (origin.category === 'generated') {
        assert.ok(origin.generationId && generations.get(origin.generationId)?.status === 'built', 'Generated corpus source without successful build evidence')
      }
    }
  }
}

/** 固定大小、顺序与 gzip 头的压缩分片，普通验收不访问网络。 */
export async function writeCorpusArchive(directory: string, input: readonly CorpusDocument[], metadata: CorpusMetadata, shardSize = 256): Promise<CorpusManifest> {
  assert.ok(Number.isSafeInteger(shardSize) && shardSize > 0, 'Invalid corpus shard size')
  const documents = mergeCorpusDocuments(input)
  validateReferences(documents, metadata)
  const resources = await readCorpusEvidence(directory, metadata.evidence ?? [])
  validateFrozenReferences(metadata, documents, resources)
  const previous = await previousArchiveFiles(directory)
  await mkdir(directory, { recursive: true })
  const shards: CorpusManifest['shards'] = []
  const content = createHash('sha256')
  for (let offset = 0; offset < documents.length; offset += shardSize) {
    const source = `${documents.slice(offset, offset + shardSize).map(corpusJson).join('\n')}\n`
    content.update(source)
    const compressed = gzipSync(source, { level: 9 })
    const file = `templates-${String(shards.length + 1).padStart(4, '0')}.jsonl.gz`
    await writeFile(path.join(directory, file), compressed)
    shards.push({ file, sha256: corpusHash(compressed), bytes: compressed.length })
  }
  const manifest: CorpusManifest = {
    ...metadata,
    schemaVersion: 1,
    documents: documents.length,
    origins: documents.reduce((sum, document) => sum + document.origins.length, 0),
    contentSha256: content.digest('hex'),
    shards,
  }
  await writeFile(path.join(directory, 'manifest.json'), `${corpusJson(manifest)}\n`)
  await cleanPreviousArchiveFiles(directory, previous, [...shards, ...(metadata.evidence ?? [])].map(file => file.file))
  return manifest
}

/** 验证压缩字节、原文、来源引用和确定性顺序后才返回语料。 */
export async function readCorpusArchive(directory: string): Promise<{ manifest: CorpusManifest, documents: CorpusDocument[] }> {
  const parsed: unknown = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'))
  assert.ok(parsed && typeof parsed === 'object' && 'schemaVersion' in parsed && parsed.schemaVersion === 1, 'Unknown corpus manifest')
  const manifest = parsed as CorpusManifest
  assert.ok(Array.isArray(manifest.shards) && Array.isArray(manifest.profiles) && Array.isArray(manifest.licenses) && Array.isArray(manifest.generations) && Array.isArray(manifest.repositories), 'Invalid corpus manifest collections')
  const documents: CorpusDocument[] = []
  const content = createHash('sha256')
  const files = new Set<string>()
  for (const shard of manifest.shards) {
    assert.ok(/^templates-\d{4,}\.jsonl\.gz$/.test(shard.file) && !files.has(shard.file), 'Invalid or duplicate corpus shard')
    files.add(shard.file)
    const compressed = await readFile(path.join(directory, shard.file))
    assert.equal(compressed.length, shard.bytes, 'Corpus shard size mismatch')
    assert.equal(corpusHash(compressed), shard.sha256, 'Corpus shard integrity mismatch')
    const source = gunzipSync(compressed).toString('utf8')
    content.update(source)
    assert.ok(source.endsWith('\n'), 'Incomplete corpus shard')
    for (const line of source.slice(0, -1).split('\n')) {
      const value: unknown = JSON.parse(line)
      assert.ok(value && typeof value === 'object' && 'source' in value && typeof value.source === 'string' && 'origins' in value && Array.isArray(value.origins), 'Invalid corpus document')
      documents.push(value as CorpusDocument)
    }
  }
  assert.equal(content.digest('hex'), manifest.contentSha256, 'Corpus content integrity mismatch')
  assert.equal(documents.length, manifest.documents, 'Corpus document count mismatch')
  assert.equal(documents.reduce((sum, document) => sum + document.origins.length, 0), manifest.origins, 'Corpus origin count mismatch')
  assert.equal(corpusJson(mergeCorpusDocuments(documents)), corpusJson(documents), 'Corpus order, source integrity or deduplication mismatch')
  validateReferences(documents, manifest)
  assert.ok(manifest.evidence === undefined || Array.isArray(manifest.evidence), 'Invalid corpus evidence collection')
  const resources = await readCorpusEvidence(directory, manifest.evidence ?? [])
  validateFrozenReferences(manifest, documents, resources)
  return { manifest, documents }
}
