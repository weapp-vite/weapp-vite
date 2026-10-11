import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectTypeTestFiles } from './contracts'

describe('public type contract selection', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'type-contracts-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function files(...names: string[]) {
    await Promise.all(names.map(async (name) => {
      const file = path.join(root, name)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, '')
    }))
  }

  it('selects nested explicit TS and TSX contracts without unrelated package files', async () => {
    await files('test-d/api.test-d.ts', 'test-d/nested/view.test-d.tsx', 'test-d/helper.ts', 'dist/api.test-d.ts', 'node_modules/dependency/test-d/foreign.test-d.ts')
    expect(await collectTypeTestFiles(root, {}, { files: 'test-d/**/*.test-d.{ts,tsx}' })).toEqual([
      'test-d/api.test-d.ts',
      'test-d/nested/view.test-d.tsx',
    ])
  })

  it('uses the command working directory for fixture-wide patterns', async () => {
    await files('fixture/api.test-d.ts', 'fixture/nested/view.test-d.ts', 'other.test-d.ts')
    expect(await collectTypeTestFiles(path.join(root, 'fixture'), {}, { files: '**/*.test-d.ts' })).toEqual([
      'api.test-d.ts',
      'nested/view.test-d.ts',
    ])
  })

  it('accepts exact file patterns and excludes directories with matching names', async () => {
    await files('test/api.test-d.ts', 'test/other.test-d.ts')
    await mkdir(path.join(root, 'test/directory.test-d.ts'))
    expect(await collectTypeTestFiles(root, {}, { files: 'test/api.test-d.ts' })).toEqual(['test/api.test-d.ts'])
    expect(await collectTypeTestFiles(root, {}, { files: 'test/*.test-d.ts' })).toEqual(['test/api.test-d.ts', 'test/other.test-d.ts'])
  })

  it('prefers both colocated contracts over the fallback directory', async () => {
    await files('dist/api.test-d.ts', 'dist/api.test-d.tsx', 'test-d/fallback.test-d.ts')
    expect(await collectTypeTestFiles(root, { types: './dist/api.d.ts' })).toEqual(['dist/api.test-d.ts', 'dist/api.test-d.tsx'])
  })

  it('uses only the basename of an explicit typings option as tsd does', async () => {
    await files('api.test-d.ts', 'dist/api.test-d.ts', 'test-d/fallback.test-d.ts')
    expect(await collectTypeTestFiles(root, {}, { typings: 'dist/api.d.ts' })).toEqual(['api.test-d.ts'])
  })

  it.each([
    { manifest: {}, directory: 'test-d' },
    { manifest: { tsd: { directory: 'contracts' } }, directory: 'contracts' },
  ])('falls back to $directory only when colocated contracts are missing', async ({ manifest, directory }) => {
    await files(`${directory}/api.test-d.ts`, `${directory}/nested/view.tsx`, 'dist/foreign.test-d.ts', 'node_modules/dependency/test-d/foreign.test-d.ts')
    expect(await collectTypeTestFiles(root, manifest)).toEqual([`${directory}/api.test-d.ts`, `${directory}/nested/view.tsx`])
  })

  it.each([
    { manifest: { typings: 'api.d.ts' }, contract: 'api.test-d.ts' },
    { manifest: { main: 'dist/entry.js' }, contract: 'entry.test-d.ts' },
  ])('resolves the default declaration name from $manifest', async ({ manifest, contract }) => {
    await files(contract, 'test-d/fallback.test-d.ts')
    expect(await collectTypeTestFiles(root, manifest)).toEqual([contract])
  })

  it('preserves the .d.mts declaration selection so the coverage guard can reject it', async () => {
    await files('dist/api.d.mts', 'dist/api.test-d.ts', 'test-d/fallback.test-d.ts')
    expect(await collectTypeTestFiles(root, { types: 'dist/api.d.mts' })).toEqual(['dist/api.d.mts'])
  })

  it('returns no contracts for absent files and fallback directories', async () => {
    expect(await collectTypeTestFiles(root, {})).toEqual([])
    expect(await collectTypeTestFiles(root, {}, { files: 'test-d/**/*.test-d.ts' })).toEqual([])
  })
})
