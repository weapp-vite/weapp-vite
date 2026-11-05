import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { repositoryRoot } from '../paths'
import { assertProfileArtifacts, prepareProfile } from './prepare'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('bundles and fingerprints executed transitive dependencies in a Node-only run', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-profile-prepare-'))
  directories.push(directory)
  const entry = path.join(directory, 'candidate.mjs')
  const output = path.join(directory, 'run')
  await writeFile(entry, 'export const marker = "controlled-built-entry"\n')
  await mkdir(output)
  const prepared = await prepareProfile(entry, output, false)
  expect(prepared.browserCode).toBeUndefined()
  const inputs = Object.keys(prepared.artifacts)
  expect(inputs.some(file => file.includes('/node_modules/domhandler/'))).toBe(true)
  expect(inputs.some(file => file.includes('/node_modules/entities/'))).toBe(true)
  expect(typeof prepared.run).toBe('function')
  expect(typeof prepared.runWithCheckpoint).toBe('function')
  const checkpoints: string[] = []
  await prepared.runWithCheckpoint([], [], { rounds: 1, warmup: 0, operations: ['parse'] }, async (record) => {
    checkpoints.push(record.kind)
  })
  expect(checkpoints).toEqual(['start', 'complete'])
  await assertProfileArtifacts(prepared.artifacts)
  expect(await readFile(path.join(output, 'profile-runtime.mjs'), 'utf8')).toContain('controlled-built-entry')
  await writeFile(entry, 'export const marker = "changed-built-entry"\n')
  await expect(assertProfileArtifacts(prepared.artifacts)).rejects.toThrow('artifact changed during measurement')
})

it('records and rechecks actual baseline and current chunks behind forwarding roots', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-regression-chunks-'))
  directories.push(directory)
  const entries: string[] = []
  const chunks: string[] = []
  for (const arm of ['baseline', 'current']) {
    const entry = path.join(directory, `${arm}.mjs`)
    const chunk = path.join(directory, `${arm}-chunk.mjs`)
    await writeFile(entry, `export { parse } from './${arm}-chunk.mjs'\n`)
    await writeFile(chunk, 'export function parse(source) { return { source, tokens: [], children: [] } }\n')
    entries.push(entry)
    chunks.push(chunk)
  }
  const output = path.join(directory, 'run')
  await mkdir(output)
  const prepared = await prepareProfile(entries[1]!, output, false, entries[0]!)
  const inputs = await Promise.all(Object.keys(prepared.artifacts).map(file => realpath(path.resolve(repositoryRoot, file))))
  for (const chunk of chunks) {
    expect(inputs).toContain(await realpath(chunk))
  }
  await assertProfileArtifacts(prepared.artifacts)
  await writeFile(chunks[0]!, 'export function parse(source) { return { source, changed: true } }\n')
  await expect(assertProfileArtifacts(prepared.artifacts)).rejects.toThrow('artifact changed during measurement')
})

it('locks paired parser entities while preserving third-party dependency versions in Node and browser bundles', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-profile-entities-'))
  directories.push(directory)
  const entries: string[] = []
  for (const arm of ['baseline', 'current']) {
    const root = path.join(directory, arm)
    await mkdir(path.join(root, 'chunks'), { recursive: true })
    const entry = path.join(root, 'index.mjs')
    await writeFile(entry, 'export { parse } from "./chunks/parse.mjs"\n')
    await writeFile(path.join(root, 'chunks/parse.mjs'), `import { decodeXML } from 'entities'
if (decodeXML('&#65; &amp; B') !== 'A & B') throw new Error('Parser entity decoding changed')
export function parse(source) { return { source: decodeXML(source), tokens: [], children: [] } }
`)
    entries.push(entry)
  }
  const output = path.join(directory, 'run')
  await mkdir(output)
  const prepared = await prepareProfile(entries[1]!, output, true, entries[0]!)
  const require = createRequire(path.join(repositoryRoot, 'packages/wxml/package.json'))
  const htmlRequire = createRequire(require.resolve('htmlparser2'))
  const serializerRequire = createRequire(require.resolve('dom-serializer'))
  const inputs = await Promise.all(Object.keys(prepared.artifacts).map(file => realpath(path.resolve(repositoryRoot, file))))
  for (const file of [require.resolve('entities'), htmlRequire.resolve('entities/decode'), serializerRequire.resolve('entities')]) {
    expect(inputs).toContain(await realpath(file))
  }
  expect(prepared.browserCode).toBeTypeOf('string')
  expect(prepared.run([], [], { rounds: 1, warmup: 0, operations: ['parse'] }).errors).toEqual([])
  await assertProfileArtifacts(prepared.artifacts)
})
