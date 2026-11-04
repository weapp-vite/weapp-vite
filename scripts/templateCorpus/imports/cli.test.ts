import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { readCorpusArchive } from '../archive'
import { corpusMain } from '../index'
import { corpusHash, corpusJson } from '../integrity'
import { nativeMetadata, sourceIdentity, sourceTree } from './testFixtures'

const temporary: string[] = []

async function inputs() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-cli-import-'))
  temporary.push(directory)
  const source = '<view>offline</view>'
  const file = 'pages/home.wxml'
  const tree = [...sourceTree, { path: file, type: 'blob', sha: createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex') }]
  const { metadata } = nativeMetadata()
  const collection = {
    documents: [{ source, sha256: corpusHash(source), origins: [{ ...sourceIdentity, path: file, platform: 'weapp', profileId: 'weapp-legacy', category: 'native', expectation: 'valid' }] }],
    licenses: metadata.licenses,
    repositories: [{ ...metadata.repositories[0]!, evidence: undefined, treeFiles: tree.length, treeSha256: corpusHash(corpusJson(tree)) }],
    excluded: [],
  }
  await mkdir(path.join(directory, 'input'))
  await writeFile(path.join(directory, 'input/collection.json'), corpusJson(collection))
  await writeFile(path.join(directory, 'input/sources.json'), corpusJson([{ ...sourceIdentity, tree, configuration: sourceIdentity }]))
  return { directory, collection }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('imports an offline collection only with its complete source mapping and retains a reusable collection report', async () => {
  const { directory, collection } = await inputs()
  const output = path.join(directory, 'archive')
  const reports = path.join(directory, 'reports')
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const args = ['collect', '--collection', path.join(directory, 'input/collection.json'), '--output', output, '--reports', reports]
  await expect(corpusMain(args)).rejects.toThrow('Missing complete tree/configuration')
  await corpusMain([...args, '--source-evidence', path.join(directory, 'input/sources.json')])
  expect((await readCorpusArchive(output)).documents).toEqual(collection.documents)
  const raw: unknown = JSON.parse(await readFile(path.join(reports, 'collection.json'), 'utf8'))
  expect(raw).toMatchObject({ documents: collection.documents, licenses: collection.licenses, excluded: [] })
  expect(raw).toHaveProperty('repositories.0.evidence.0.file')
})
