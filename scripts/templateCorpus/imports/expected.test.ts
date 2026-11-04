import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { expectedSnapshotsToDocuments, extractStaticSnapshots } from '../generate/expected'
import { corpusHash, corpusJson } from '../integrity'
import { importExpectedSnapshots } from './expected'
import { freezeNativeEvidence } from './native'
import { nativeMetadata, sourceIdentity, sourceTree } from './testFixtures'
import { validateFrozenReferences } from './verify'

const temporary: string[] = []

async function expectedProject() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-expected-'))
  temporary.push(directory)
  const text = 'exports["ali target"] = "<view a:if=\\"{{yes}}\\">支付宝</view>";\nexports["wx target"] = "<view wx:if=\\"{{yes}}\\">微信</view>";\nexports["dynamic"] = unknown();\n'
  const file = 'test/compiler.snap'
  const extraction = extractStaticSnapshots(text, 'literal')
  const documents = expectedSnapshotsToDocuments(extraction, sourceIdentity, file, 'alipay-xml', 'literal', ['ali target'])
  const files = {
    [`upstream/${file}`]: text,
    'expected-source.json': corpusJson({ schemaVersion: 1, identity: sourceIdentity, profileId: 'alipay-xml', format: 'literal', keys: ['ali target'], original: { file, sha256: corpusHash(text), bytes: Buffer.byteLength(text) } }),
    'expected-documents.jsonl': `${documents.map(corpusJson).join('\n')}\n`,
    'expected-extraction.json': corpusJson(extraction),
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true })
    await writeFile(path.join(directory, file), source)
  }
  const tree = [...sourceTree, { path: file, type: 'blob' as const, sha: createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex') }]
  return { directory, text, tree }
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('imports selected static snapshots while freezing the complete original blob and all extraction rejections', async () => {
  const { directory, tree } = await expectedProject()
  const imported = await importExpectedSnapshots([directory])
  expect(imported.documents).toHaveLength(1)
  expect(imported.documents[0]!.source).toContain('支付宝')
  const { metadata } = nativeMetadata()
  const native = freezeNativeEvidence({
    repositories: [{ ...metadata.repositories[0]!, treeFiles: tree.length, treeSha256: corpusHash(corpusJson(tree)) }],
    sources: [{ ...sourceIdentity, tree, configuration: sourceIdentity, snapshots: imported.sources[0]!.snapshots }],
    discovery: [],
  })
  metadata.repositories = native.repositories
  await rm(directory, { recursive: true, force: true })
  expect(() => validateFrozenReferences(metadata, imported.documents, native.resources)).not.toThrow()
  imported.documents[0]!.origins[0]!.snapshot!.key = 'wx target'
  expect(() => validateFrozenReferences(metadata, imported.documents, native.resources)).toThrow('static key or UTF16 range changed')
})

it('rejects replaced upstream bytes and altered extraction/documents instead of trusting their declared identities', async () => {
  const replaced = await expectedProject()
  await writeFile(path.join(replaced.directory, 'upstream/test/compiler.snap'), 'replacement')
  await expect(importExpectedSnapshots([replaced.directory])).rejects.toThrow('Imported evidence size changed')
  const altered = await expectedProject()
  await writeFile(path.join(altered.directory, 'expected-extraction.json'), corpusJson({ snapshots: [], rejected: [] }))
  await expect(importExpectedSnapshots([altered.directory])).rejects.toThrow('static snapshot extraction changed')
  const documents = await expectedProject()
  await writeFile(path.join(documents.directory, 'expected-documents.jsonl'), '')
  await expect(importExpectedSnapshots([documents.directory])).rejects.toThrow('expected documents differ')
})
