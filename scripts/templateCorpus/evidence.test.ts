import type { CorpusEvidenceResource } from './evidence'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { afterEach, expect, it } from 'vitest'
import { corpusHash, corpusJson } from './archive'
import { readCorpusEvidence, writeCorpusEvidence } from './evidence'

const temporary: string[] = []

async function directory() {
  const result = await mkdtemp(path.join(os.tmpdir(), 'corpus-evidence-'))
  temporary.push(result)
  return result
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('freezes ordered, byte-identical evidence with both compressed and original identities', async () => {
  const first = await directory()
  const second = await directory()
  const resources: CorpusEvidenceResource[] = [
    { file: 'sources/tree.json', kind: 'tree', content: corpusJson([{ path: 'home.wxml', sha: 'a'.repeat(40) }]) },
    { file: 'generated/inputs.jsonl', kind: 'input', content: '\uFEFF{"file":"page.vue","source":"😀"}\r\n' },
    { file: 'generated/build.log', kind: 'log', content: new TextEncoder().encode('build completed\n') },
  ]
  const identities = await writeCorpusEvidence(first, resources)
  expect(await writeCorpusEvidence(second, [...resources].reverse())).toEqual(identities)
  for (const identity of identities) {
    expect(await readFile(path.join(first, identity.file))).toEqual(await readFile(path.join(second, identity.file)))
  }
  const restored = await readCorpusEvidence(first, identities)
  expect(restored.map(item => item.file)).toEqual(resources.map(item => item.file).sort())
  const input = restored.find(item => item.kind === 'input')!
  expect(input.content).toEqual(new TextEncoder().encode(resources[1]!.content as string))
})

it('refuses traversal, dependency directories, compiler bundles and duplicate case-folded labels', async () => {
  const output = await directory()
  for (const file of ['../tree.json', '/tree.json', 'C:/tree.json', 'source\\tree.json', 'node_modules/pkg/package.json', 'packages/Node_Modules/x.json', 'uni.compiler.js']) {
    await expect(writeCorpusEvidence(output, [{ file, kind: 'report', content: '{}' }])).rejects.toThrow('disallowed')
  }
  await expect(writeCorpusEvidence(output, [
    { file: 'input/A.json', kind: 'input', content: '{}' },
    { file: 'input/a.json', kind: 'input', content: '{}' },
  ])).rejects.toThrow('Duplicate corpus evidence resource')
})

it('rejects altered compressed bytes and invalid reference paths before decoding', async () => {
  const output = await directory()
  const identities = await writeCorpusEvidence(output, [{ file: 'tree.json', kind: 'tree', content: '{}' }])
  const identity = identities.find(item => item.file !== 'evidence/index.json.gz')!
  const compressed = await readFile(path.join(output, identity.file))
  compressed[compressed.length - 1] = compressed[compressed.length - 1]! ^ 1
  await writeFile(path.join(output, identity.file), compressed)
  await expect(readCorpusEvidence(output, identities)).rejects.toThrow('compressed integrity mismatch')
  await expect(readCorpusEvidence(output, [{ ...identity, file: '../tree.json.gz' }])).rejects.toThrow('Invalid or duplicate corpus evidence file')
})

it('checks the original data checksum independently of the compressed index checksum', async () => {
  const output = await directory()
  const identities = await writeCorpusEvidence(output, [{ file: 'tree.json', kind: 'tree', content: '{}' }])
  const index = identities.find(item => item.file === 'evidence/index.json.gz')!
  const parsed: unknown = JSON.parse(gunzipSync(await readFile(path.join(output, index.file))).toString('utf8'))
  const value = parsed as { entries: Array<{ sha256: string }> }
  value.entries[0]!.sha256 = 'a'.repeat(64)
  const compressed = gzipSync(corpusJson(value), { level: 9 })
  await writeFile(path.join(output, index.file), compressed)
  index.sha256 = corpusHash(compressed)
  index.bytes = compressed.length
  await expect(readCorpusEvidence(output, identities)).rejects.toThrow('source integrity mismatch')
})

it('requires an index with an exact one-to-one inventory of frozen resource files', async () => {
  const output = await directory()
  const identities = await writeCorpusEvidence(output, [{ file: 'tree.json', kind: 'tree', content: '{}' }])
  await expect(readCorpusEvidence(output, identities.filter(item => item.file !== 'evidence/index.json.gz'))).rejects.toThrow('Missing corpus evidence index')
  await expect(readCorpusEvidence(output, identities.filter(item => item.file === 'evidence/index.json.gz'))).rejects.toThrow('index/file count mismatch')
  expect(await readCorpusEvidence(output, [])).toEqual([])
})
