import type { AnalyzeSubpackagesResult } from '../analyze/subpackages'
import type { DashboardFileReader } from './content'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { createDashboardArtifactSnapshot, MAX_DASHBOARD_FILE_CONTENT_BYTES } from './artifacts'
import { createDashboardFileReader } from './content'

const temporaryRoots: string[] = []
const readers: DashboardFileReader[] = []

function createAnalyzeResult(source = 'entry.ts'): AnalyzeSubpackagesResult {
  return {
    packages: [{
      id: 'main',
      label: 'main',
      type: 'main',
      files: [{ file: 'entry.js', type: 'chunk', from: 'main', source, sourceType: 'src' }],
    }],
    modules: [],
    subPackages: [],
    glassEasel: {
      detected: false,
      minimumBaseLibrary: '3.8.12',
      migrationGuide: '',
      diagnostics: [],
      summary: { errors: 0, warnings: 0 },
    },
  }
}

async function createReader(content: string, source = 'entry.ts') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-excerpt-'))
  temporaryRoots.push(root)
  const srcRoot = path.join(root, 'src')
  await fs.mkdir(srcRoot)
  await fs.writeFile(path.join(srcRoot, 'entry.ts'), content, 'utf8')
  const artifacts = createDashboardArtifactSnapshot()
  artifacts.capture('entry.js', content)
  const reader = createDashboardFileReader({ srcRoot }, createAnalyzeResult(source), artifacts.files)
  readers.push(reader)
  return { root, srcRoot, reader }
}

afterEach(async () => {
  for (const reader of readers.splice(0)) {
    reader.dispose()
  }
  await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe.each(['source', 'artifact'] as const)('dashboard %s excerpts', (kind) => {
  const filePath = kind === 'source' ? 'entry.ts' : 'entry.js'

  it('preserves UTF-16 offsets, surrogate halves, CRLF and complete UTF-8 size', async () => {
    const content = 'A\uD834\uDD1E中\r\nZ'
    const { reader } = await createReader(content)
    const full = await reader.read({ kind, path: filePath })
    expect(full.content).toBe(content)
    expect(full.size).toBe(11)
    expect(full.range).toBeUndefined()

    const fragments: string[] = []
    const expected = ['A\uD834', '\uDD1E中', '\r\n', 'Z']
    for (let index = 0; index < expected.length; index++) {
      const offset = index * 2
      const excerpt = await reader.read({ kind, path: filePath, range: { offset, limit: 2 } })
      expect(excerpt).toMatchObject({
        content: expected[index],
        size: 11,
        range: { offset, totalCharacters: 7, nextOffset: index === 3 ? null : offset + 2 },
      })
      fragments.push(excerpt.content)
    }
    expect(fragments.join('')).toBe(content)
  })

  it.each(['', 'end'])('distinguishes EOF from an out-of-bounds offset for %j', async (content) => {
    const { reader } = await createReader(content)
    await expect(reader.read({ kind, path: filePath, range: { offset: content.length, limit: 1 } }))
      .resolves
      .toMatchObject({
        content: '',
        size: Buffer.byteLength(content, 'utf8'),
        range: { offset: content.length, totalCharacters: content.length, nextOffset: null },
      })
    await expect(reader.read({ kind, path: filePath, range: { offset: content.length + 1, limit: 1 } }))
      .rejects
      .toThrow(RangeError)
  })

  it('returns bounded excerpts of a large single line without truncating unrestricted reads', async () => {
    const content = `${'x'.repeat(200_000)}last`
    const { reader } = await createReader(content)
    await expect(reader.read({ kind, path: filePath, range: { offset: 100_000, limit: 16384 } }))
      .resolves
      .toMatchObject({
        content: 'x'.repeat(16384),
        size: 200_004,
        range: { offset: 100_000, totalCharacters: 200_004, nextOffset: 116_384 },
      })
    await expect(reader.read({ kind, path: filePath, range: { offset: 200_000, limit: 16384 } }))
      .resolves
      .toMatchObject({
        content: 'last',
        size: 200_004,
        range: { offset: 200_000, totalCharacters: 200_004, nextOffset: null },
      })
    expect((await reader.read({ kind, path: filePath })).content).toBe(content)
  })

  it('retains the full-file size limit even for a one-character excerpt', async () => {
    const { reader } = await createReader('x'.repeat(MAX_DASHBOARD_FILE_CONTENT_BYTES + 1))
    await expect(reader.read({ kind, path: filePath, range: { offset: 0, limit: 1 } }))
      .rejects
      .toThrow(`文件超过 ${MAX_DASHBOARD_FILE_CONTENT_BYTES} 字节`)
  })

  it('rejects unlisted paths even when an excerpt is requested', async () => {
    const { reader, srcRoot } = await createReader('allowed')
    await fs.writeFile(path.join(srcRoot, 'unlisted.ts'), 'not in the report')
    await expect(reader.read({ kind, path: 'unlisted.ts', range: { offset: 0, limit: 1 } }))
      .rejects
      .toThrow('必须传入合法的 kind 和相对路径。')
    await expect(reader.read({ kind, path: '../entry.ts', range: { offset: 0, limit: 1 } }))
      .rejects
      .toThrow('必须传入合法的 kind 和相对路径。')
  })
})

describe('dashboard excerpt validation and source security', () => {
  it.each([
    { offset: -1, limit: 1 },
    { offset: 0.5, limit: 1 },
    { offset: Number.MAX_SAFE_INTEGER + 1, limit: 1 },
    { offset: Number.POSITIVE_INFINITY, limit: 1 },
    { offset: 0, limit: 0 },
    { offset: 0, limit: 16385 },
    { offset: 0, limit: 1.5 },
    { offset: 0 },
    { limit: 1 },
    null,
  ])('rejects invalid range %j before attempting to access a missing source or artifact', async (range) => {
    const { reader } = await createReader('content', 'missing.ts')
    await expect(reader.read({ kind: 'source', path: 'missing.ts', range })).rejects.toThrow(ZodError)
    await expect(reader.read({ kind: 'artifact', path: 'missing.js', range })).rejects.toThrow(ZodError)
  })

  it('rejects excerpts through an allowlisted linked directory', async () => {
    const { root, srcRoot, reader } = await createReader('content', 'linked/secret.ts')
    const outside = path.join(root, 'outside')
    await fs.mkdir(outside)
    await fs.writeFile(path.join(outside, 'secret.ts'), 'private content')
    await fs.symlink(outside, path.join(srcRoot, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
    await expect(reader.read({ kind: 'source', path: 'linked/secret.ts', range: { offset: 0, limit: 1 } }))
      .rejects
      .toThrow('文件路径包含不允许的符号链接。')
  })
})
