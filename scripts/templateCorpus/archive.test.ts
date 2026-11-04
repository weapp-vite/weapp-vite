import type { CorpusDocument, CorpusMetadata, CorpusOrigin } from './types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { corpusHash, corpusJson, mergeCorpusDocuments, readCorpusArchive, writeCorpusArchive } from './archive'
import { mitFixtureLicense } from './collect/licenseFixtures'
import { writeCorpusEvidence } from './evidence'
import { freezeNativeEvidence } from './imports'
import { encodeLicenseFile, licenseFileBytes } from './license'
import { corpusPolicy, corpusProfiles } from './profiles'

const temporary: string[] = []
const commit = 'a'.repeat(40)
const tree = [{ path: 'LICENSE', type: 'blob' as const, sha: createHash('sha1').update(`blob ${Buffer.byteLength(mitFixtureLicense)}\0`).update(mitFixtureLicense).digest('hex') }]
const origin: CorpusOrigin = {
  repository: 'example/templates',
  commit,
  path: 'pages/home.wxml',
  platform: 'weapp',
  profileId: 'weapp-legacy',
  category: 'native',
  expectation: 'valid',
  licenseId: 'license-example',
}

function document(source: string, origins = [origin]): CorpusDocument {
  return { source, sha256: corpusHash(source), origins: origins.map(item => item === origin ? { ...item, path: `pages/${corpusHash(source)}.wxml` } : item) }
}

function metadata(): CorpusMetadata {
  return {
    id: 'test-v1',
    profiles: corpusProfiles,
    policy: corpusPolicy,
    generations: [],
    discovery: [],
    licenses: [{ id: origin.licenseId, repository: origin.repository, commit, spdx: 'MIT', files: [{ path: 'LICENSE', text: mitFixtureLicense, sha256: corpusHash(mitFixtureLicense) }] }],
    repositories: [{ repository: origin.repository, commit, licenseId: origin.licenseId, independentRepository: origin.repository, treeSha256: corpusHash(corpusJson(tree)), treeFiles: tree.length, selectedFiles: 1, excludedFiles: 0, complete: true }],
  }
}

async function writeArchive(output: string, input: CorpusDocument[], frozen = metadata(), shardSize?: number) {
  if (!frozen.evidence) {
    const blobs = [
      ...input.flatMap(document => document.origins.filter(origin => origin.category !== 'generated').map(origin => ({ path: origin.path, type: 'blob' as const, sha: createHash('sha1').update(`blob ${Buffer.byteLength(document.source)}\0`).update(document.source).digest('hex') }))),
      ...frozen.licenses.flatMap(license => license.files.map((file) => {
        const bytes = licenseFileBytes(file)
        return { path: file.path, type: 'blob' as const, sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') }
      })),
    ]
    const completeTree = [...new Map([...tree, ...blobs].map(file => [file.path, file])).values()].sort((a, b) => a.path.localeCompare(b.path, 'en'))
    frozen.repositories[0]!.treeFiles = completeTree.length
    frozen.repositories[0]!.treeSha256 = corpusHash(corpusJson(completeTree))
    const native = freezeNativeEvidence({ repositories: frozen.repositories, sources: [{ repository: origin.repository, commit, tree: completeTree, configuration: { repository: origin.repository, commit, selections: [] } }], discovery: frozen.discovery })
    frozen.repositories = native.repositories
    frozen.evidence = await writeCorpusEvidence(output, native.resources)
  }
  return writeCorpusArchive(output, input, frozen, shardSize)
}

async function directory() {
  const result = await mkdtemp(path.join(os.tmpdir(), 'template-corpus-'))
  temporary.push(result)
  return result
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('stores content once while preserving platform membership and complete source identities', () => {
  const alipay = { ...origin, path: 'pages/home.axml', platform: 'alipay', profileId: 'alipay-xml' }
  const merged = mergeCorpusDocuments([document('<view/>'), document('<view/>', [alipay, origin])])
  expect(merged).toHaveLength(1)
  expect(merged[0]!.origins).toHaveLength(2)
  expect(merged[0]!.origins.map(item => item.platform).sort()).toEqual(['alipay', 'weapp'])
  expect(() => mergeCorpusDocuments([{ ...document('different'), sha256: corpusHash('<view/>') }])).toThrow('source hash mismatch')
})

it('writes byte-identical gzip shards independent of input ordering and preserves BOM, Unicode and CRLF', async () => {
  const first = await directory()
  const second = await directory()
  const input = [document('\uFEFF<view title="😀">\r\n你好\r\n</view>'), document('<text>two</text>')]
  const manifest = await writeArchive(first, input, metadata(), 1)
  await writeArchive(second, [...input].reverse(), metadata(), 1)
  expect(manifest.documents).toBe(2)
  expect(manifest.origins).toBe(2)
  for (const file of ['manifest.json', ...manifest.shards.map(shard => shard.file)]) {
    expect(await readFile(path.join(first, file))).toEqual(await readFile(path.join(second, file)))
  }
  const restored = await readCorpusArchive(first)
  expect(restored.documents.map(item => item.source).sort()).toEqual(input.map(item => item.source).sort())
})

it('rejects altered compressed bytes and unsafe shard paths before reading them', async () => {
  const output = await directory()
  const manifest = await writeArchive(output, [document('<view/>')])
  const shard = path.join(output, manifest.shards[0]!.file)
  const bytes = await readFile(shard)
  bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1
  await writeFile(shard, bytes)
  await expect(readCorpusArchive(output)).rejects.toThrow('shard integrity mismatch')
  manifest.shards[0]!.file = '../templates-0001.jsonl.gz'
  await writeFile(path.join(output, 'manifest.json'), corpusJson(manifest))
  await expect(readCorpusArchive(output)).rejects.toThrow('Invalid or duplicate corpus shard')
})

it('refuses missing attribution, orphan origins and incomplete repository evidence', async () => {
  const output = await directory()
  await expect(writeArchive(output, [document('<view/>', [])])).rejects.toThrow('without an origin')
  const missingLicense = metadata()
  missingLicense.licenses = []
  await expect(writeArchive(output, [document('<view/>')], missingLicense)).rejects.toThrow('Missing corpus source license')
  const incomplete = metadata()
  incomplete.repositories[0]!.complete = false
  await expect(writeArchive(output, [document('<view/>')], incomplete)).rejects.toThrow('complete frozen repository')
  const alteredLicense = metadata()
  const file = alteredLicense.licenses[0]!.files[0]!
  if ('text' in file) {
    file.text += 'altered'
  }
  await expect(writeArchive(output, [document('<view/>')], alteredLicense)).rejects.toThrow('License content hash mismatch')
})

it('requires successful generated evidence and explicit known-invalid diagnostic expectations', async () => {
  const output = await directory()
  const generated = document('<view/>', [{ ...origin, category: 'generated', generationId: 'build-example' }])
  await expect(writeArchive(output, [generated])).rejects.toThrow('successful build evidence')
  const compiled = metadata()
  compiled.generations.push({ id: 'build-example', framework: 'example', version: '1.0.0', target: 'weapp', mode: 'production', status: 'built', evidence: [{ file: 'build/evidence.json', sha256: corpusHash('{}'), bytes: 2 }] })
  await expect(writeArchive(output, [generated], compiled)).rejects.toThrow('Unstable frozen generation reference prefix')
  await expect(writeArchive(output, [document('<view>', [{ ...origin, expectation: 'invalid' }])])).rejects.toThrow('explicit diagnostic expectations')
})

it('serializes stable JSON keys without silently dropping unsupported array values or invalid numbers', () => {
  expect(corpusJson({ z: 1, a: { y: 2, x: 3 }, absent: undefined })).toBe('{"a":{"x":3,"y":2},"z":1}')
  expect(() => corpusJson([undefined])).toThrow('JSON values')
  expect(() => corpusJson({ number: Number.NaN })).toThrow('finite numbers')
  expect(() => corpusJson({ number: Number.POSITIVE_INFINITY })).toThrow('finite numbers')
})

it('requires frozen source mappings and verifies every resource during archive writes and reads', async () => {
  const output = await directory()
  await expect(writeCorpusArchive(output, [document('<view/>')], metadata())).rejects.toThrow('Missing frozen source tree/configuration references')
  const frozen = metadata()
  await writeArchive(output, [document('<view/>')], frozen)
  expect((await readCorpusArchive(output)).manifest.evidence).toEqual(frozen.evidence)
  await writeFile(path.join(output, frozen.evidence![0]!.file), 'replaced')
  await expect(readCorpusArchive(output)).rejects.toThrow('Corpus evidence compressed size mismatch')
})

it('rechecks license scope and preserves unused non-UTF8 attribution bytes without distributing blocked templates', async () => {
  const output = await directory()
  const frozen = metadata()
  const binary = encodeLicenseFile('copied/LICENSE', Uint8Array.from([0x46, 0x72, 0x6F, 0x6D, 0xA3, 0xBA]))
  frozen.licenses[0]!.files.push(binary)
  await writeArchive(output, [document('<view/>')], frozen)
  expect((await readCorpusArchive(output)).manifest.licenses[0]!.files[1]).toEqual(binary)
  await expect(writeArchive(output, [document('<view/>', [{ ...origin, path: 'copied/page.wxml' }])], frozen)).rejects.toThrow('license scope is unconfirmed')
  await expect(writeArchive(output, [document('<view/>', [{ ...origin, licensePath: 'unrelated/LICENSE' }])], frozen)).rejects.toThrow('license grant path mismatch')
})
