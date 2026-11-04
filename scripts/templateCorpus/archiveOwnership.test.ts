import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { cleanPreviousArchiveFiles, previousArchiveFiles } from './archiveOwnership'
import { corpusHash, corpusJson } from './integrity'

const temporary: string[] = []

async function directory() {
  const result = await mkdtemp(path.join(os.tmpdir(), 'corpus-ownership-'))
  temporary.push(result)
  return result
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('cleans only retired manifest-owned resources and preserves unrelated files', async () => {
  const output = await directory()
  const owned = ['templates-0001.jsonl.gz', 'templates-0002.jsonl.gz'].map(file => ({ file, sha256: corpusHash(file), bytes: Buffer.byteLength(file) }))
  for (const identity of owned) {
    await writeFile(path.join(output, identity.file), identity.file)
  }
  await writeFile(path.join(output, 'unowned.jsonl.gz'), 'manual note')
  await writeFile(path.join(output, 'manifest.json'), corpusJson({ schemaVersion: 1, shards: owned }))
  const previous = await previousArchiveFiles(output)
  await cleanPreviousArchiveFiles(output, previous, [owned[0]!.file])
  expect(await readFile(path.join(output, owned[0]!.file), 'utf8')).toBe(owned[0]!.file)
  await expect(readFile(path.join(output, owned[1]!.file))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(path.join(output, 'unowned.jsonl.gz'), 'utf8')).toBe('manual note')
  await expect(cleanPreviousArchiveFiles(output, previous, [owned[0]!.file])).resolves.toBeUndefined()
})

it('rejects unsafe ownership and leaves replaced or symbolically linked resources untouched', async () => {
  const output = await directory()
  const identity = { file: 'templates-0001.jsonl.gz', sha256: corpusHash('original'), bytes: 8 }
  await writeFile(path.join(output, 'manifest.json'), corpusJson({ schemaVersion: 1, shards: [{ ...identity, file: '../outside.gz' }] }))
  await expect(previousArchiveFiles(output)).rejects.toThrow('Unsafe previous corpus ownership identity')
  await writeFile(path.join(output, identity.file), 'replaced')
  await expect(cleanPreviousArchiveFiles(output, [identity], [])).rejects.toThrow('was replaced')
  await rm(path.join(output, identity.file))
  await writeFile(path.join(output, 'external.gz'), 'original')
  await symlink('external.gz', path.join(output, identity.file))
  await expect(cleanPreviousArchiveFiles(output, [identity], [])).rejects.toThrow('no longer an owned regular file')
  expect(await readFile(path.join(output, 'external.gz'), 'utf8')).toBe('original')
})
