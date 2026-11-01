import type { FormatCandidate } from './prepare'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { commitFormatting } from './transaction'

const roots: string[] = []
async function fixture(): Promise<{ root: string, candidates: FormatCandidate[] }> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'format-transaction-'))
  roots.push(root)
  const candidates = ['a.js', 'b.js'].map(name => ({ file: path.join(root, name), source: 'const x=1', formatted: 'const x = 1\n' }))
  for (const candidate of candidates) {
    await fs.writeFile(candidate.file, candidate.source)
  }
  return { root, candidates }
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

it('leaves every source intact when staging partially writes and then fails', async () => {
  const { root, candidates } = await fixture()
  const io = { ...fs, writeFile: (async (file, data, options) => {
    await fs.writeFile(file, String(data).slice(0, 2), options)
    throw new Error('simulated ENOSPC after a partial write')
  }) as typeof fs.writeFile }
  await expect(commitFormatting(candidates, io)).rejects.toThrow(AggregateError)
  for (const candidate of candidates) {
    expect(await fs.readFile(candidate.file, 'utf8')).toBe(candidate.source)
  }
  expect((await fs.readdir(root)).sort()).toEqual(['a.js', 'b.js'])
})

it('rolls back committed files and preserves a concurrent edit', async () => {
  const { root, candidates } = await fixture()
  const rename: typeof fs.rename = async (source, destination) => {
    await fs.rename(source, destination)
    if (destination === candidates[0]!.file) {
      await fs.writeFile(candidates[1]!.file, 'external edit')
    }
  }
  await expect(commitFormatting(candidates, { ...fs, rename })).rejects.toThrow(AggregateError)
  expect(await fs.readFile(candidates[0]!.file, 'utf8')).toBe(candidates[0]!.source)
  expect(await fs.readFile(candidates[1]!.file, 'utf8')).toBe('external edit')
  expect((await fs.readdir(root)).sort()).toEqual(['a.js', 'b.js'])
})

it('replaces fully staged candidates and cleans their temporary files', async () => {
  const { root, candidates } = await fixture()
  await commitFormatting(candidates)
  for (const candidate of candidates) {
    expect(await fs.readFile(candidate.file, 'utf8')).toBe(candidate.formatted)
  }
  expect((await fs.readdir(root)).sort()).toEqual(['a.js', 'b.js'])
})
