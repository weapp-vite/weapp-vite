import type { CompilerGenerateResult } from 'weapp-tailwindcss/core'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createTailwindV4SourceEntryMatcher, isFileExcludedByTailwindV4SourceEntries } from '@weapp-tailwindcss/engine'
import { afterEach, expect, it, vi } from 'vitest'
import { compactTailwindSourceEntries } from './compact'

type SourceEntry = CompilerGenerateResult['sources'][number]

const directories: string[] = []

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function temporaryRoot() {
  const root = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'tailwind-compact-')))
  directories.push(root)
  return root
}

function entry(base: string, pattern: string, negated = true): SourceEntry {
  return { base, pattern, negated }
}

function match(entries: readonly SourceEntry[], file: string): boolean {
  return Boolean(createTailwindV4SourceEntryMatcher([...entries])?.(file))
}

function assertParity(entries: readonly SourceEntry[], files: readonly string[]) {
  for (const file of files) {
    expect(match(compactTailwindSourceEntries(entries), file), file).toBe(match(entries, file))
  }
}

const patterns = [
  '**/.git/**',
  '**/.hg/**',
  '**/node_modules/**',
  '**/*.scss',
  '**/*.lock',
  '**/*.ts',
  '**/.env',
  '**/.gitignore',
  '**/pnpm-lock.yaml',
  '**/.env.*',
  '**/tailwind.config.*.ts',
]
const files = [
  '',
  '.',
  '..',
  'index.ts',
  'styles.scss',
  'nested/styles.scss',
  '.foo.scss',
  '.foo.lock',
  '.config.ts',
  '.env',
  '.env.local',
  'nested/.env.local',
  '.git',
  '.git/config',
  'nested/.git/config',
  '.gitignore',
  '.hidden/index.ts',
  '.hidden/.foo.scss',
  'nested/.foo.scss',
  'node_modules',
  'node_modules/file.js',
  'src/node_modules/deeper/file.js',
  'a/b/node_modules/deeper/file.js',
  'pnpm-lock.yaml',
  'tailwind.config.prod.ts',
]

it('keeps original hidden-file, zero-directory and nested exclusion semantics', () => {
  const base = temporaryRoot()
  const entries = [entry(base, '**/*', false), ...patterns.map(pattern => entry(base, pattern))]
  assertParity(entries, files.map(file => path.resolve(base, file)))
  const compacted = compactTailwindSourceEntries(entries)
  for (const file of ['.foo.scss', '.foo.lock', '.config.ts']) {
    expect(match(compacted, path.join(base, file))).toBe(false)
    expect(isFileExcludedByTailwindV4SourceEntries(path.join(base, file), compacted)).toBe(false)
  }
  for (const file of ['.env.local', '.git/config', 'src/node_modules/deeper/file.js', 'styles.scss']) {
    expect(match(compacted, path.join(base, file))).toBe(false)
    expect(isFileExcludedByTailwindV4SourceEntries(path.join(base, file), compacted)).toBe(true)
  }
  assertParity([...entries, entry(base, '**/.*', false), entry(base, '**/.hidden/**', false), entry(base, '**/.git/**', false)], files.map(file => path.resolve(base, file)))
})

// 代表路径只证明字符串匹配对齐，不能代替 Windows 文件系统或正式平台验收。
it.each(['C:\\project\\src', 'C:/project/src', '\\\\server\\share\\src', '//server/share/src'])('preserves upstream matching for Windows path representation %s', (base) => {
  const entries = [entry(base, '**/*', false), ...patterns.map(pattern => entry(base, pattern))]
  assertParity(entries, files.map(file => path.win32.resolve(base, file)))
})

it('does not broaden a disabled positive scope', () => {
  const base = temporaryRoot()
  expect(match(compactTailwindSourceEntries([]), path.join(base, 'file.ts'))).toBe(false)
  const entries = [entry(base, '**/foo'), entry(base, '**/bar')]
  expect(match(compactTailwindSourceEntries(entries), path.join(base, 'file.ts'))).toBe(false)
})

it.each([
  '**/a..b',
  '**/.',
  '**/..',
  './foo',
  '/absolute/file.ts',
  'C:/absolute/file.ts',
  '**/*.{ts,js}',
  '**/foo,bar',
  'foo\\bar',
  '**/[ab].ts',
  '**/!(foo)/**',
  '**/a?b.ts',
  '**/.env.*',
])('preserves unsupported pattern %s as an ordered barrier', (pattern) => {
  const base = temporaryRoot()
  const entries = [entry(base, '**/foo'), entry(base, pattern), entry(base, '**/bar')]
  expect(compactTailwindSourceEntries(entries)).toEqual(entries)
  expect(compactTailwindSourceEntries(entries)[1]).toBe(entries[1])
})

it('keeps positive entries, lexical bases and different shapes as barriers', () => {
  const base = temporaryRoot()
  for (const barrier of [entry(base, '**/middle', false), entry(path.join(base, 'other'), '**/middle'), entry(base, '**/middle/**')]) {
    const entries = [entry(base, '**/foo'), barrier, entry(base, '**/bar')]
    expect(compactTailwindSourceEntries(entries)).toEqual(entries)
  }
})

it('preserves errors between an earlier non-match and a later matching negative entry', () => {
  const base = temporaryRoot()
  const invalid = '*'.repeat(65537)
  const entries = [entry(base, '**/*', false), entry(base, '**/foo'), entry(base, invalid), entry(base, '**/bar')]
  const compacted = compactTailwindSourceEntries(entries)
  expect(() => match(entries, path.join(base, 'bar'))).toThrow()
  expect(() => match(compacted, path.join(base, 'bar'))).toThrow()
  expect(match(entries, path.join(base, 'foo'))).toBe(false)
  expect(match(compacted, path.join(base, 'foo'))).toBe(false)
})

it('keeps duplicate-only and oversized runs intact, including the 8192-character boundary', () => {
  const base = temporaryRoot()
  const duplicates = [entry(base, '**/foo'), entry(base, '**/foo')]
  expect(compactTailwindSourceEntries(duplicates)).toEqual(duplicates)
  const limit = [entry(base, `**/${'a'.repeat(4093)}`), entry(base, `**/${'b'.repeat(4093)}`)]
  expect(compactTailwindSourceEntries(limit)).toHaveLength(1)
  expect(compactTailwindSourceEntries(limit)[0]!.pattern).toHaveLength(8192)
  const oversized = [limit[0]!, entry(base, `**/${'b'.repeat(4094)}`)]
  expect(compactTailwindSourceEntries(oversized)).toEqual(oversized)
})

it('preserves source topology and observes field changes before each subsequent file', () => {
  const base = temporaryRoot()
  const entries = [entry(base, '**/*', false), entry(base, '**/foo'), entry(base, '**/bar')]
  const topology = [...entries]
  const before = entries.map(item => ({ ...item }))
  expect(match(compactTailwindSourceEntries(entries), path.join(base, 'foo'))).toBe(false)
  expect(entries).toEqual(before)
  expect(entries.every((item, index) => item === topology[index])).toBe(true)
  entries[1]!.pattern = '**/baz'
  expect(match(compactTailwindSourceEntries(entries), path.join(base, 'foo'))).toBe(true)
  expect(match(compactTailwindSourceEntries(entries), path.join(base, 'baz'))).toBe(false)
  entries[1]!.base = path.join(base, 'outside')
  expect(match(compactTailwindSourceEntries(entries), path.join(base, 'baz'))).toBe(true)
  assertParity(entries, [path.join(base, 'baz')])
  entries[1]!.base = base
  entries[1]!.negated = false
  expect(match(compactTailwindSourceEntries(entries), path.join(base, 'baz'))).toBe(true)
  assertParity(entries, [path.join(base, 'baz')])
  entries[1]!.negated = true
  expect(match(compactTailwindSourceEntries(entries), path.join(base, 'baz'))).toBe(false)
  assertParity(entries, [path.join(base, 'baz')])
  expect(entries).toHaveLength(topology.length)
  expect(entries.every((item, index) => item === topology[index])).toBe(true)
})

it('reduces repeated base realpath calls on the first cold matching pass', () => {
  const base = temporaryRoot()
  mkdirSync(path.join(base, 'nested'))
  const candidates = ['index.wxml', 'index.json', 'nested/index.js', 'nested/style.scss'].map(file => path.join(base, file))
  for (const file of candidates) {
    writeFileSync(file, '')
  }
  const entries = [entry(base, '**/*', false), ...patterns.map(pattern => entry(base, pattern))]
  const native = vi.spyOn(realpathSync, 'native')
  const original = candidates.map(file => match(entries, file))
  const originalBaseCalls = native.mock.calls.filter(([file]) => file === base).length
  native.mockClear()
  const compacted = candidates.map(file => match(compactTailwindSourceEntries(entries), file))
  const compactedBaseCalls = native.mock.calls.filter(([file]) => file === base).length
  expect(compacted).toEqual(original)
  expect(compactedBaseCalls).toBeLessThan(originalBaseCalls)
})

it.each(['\n', '\r', '\r\n'])('keeps trailing line endings in patterns as barriers: %j', (ending) => {
  const base = temporaryRoot()
  for (const pattern of [`**/*.ts${ending}`, `**/foo${ending}`, `**/foo/**${ending}`]) {
    const entries = [entry(base, '**/*', false), entry(base, pattern), entry(base, '**/*.js')]
    expect(compactTailwindSourceEntries(entries)).toEqual(entries)
    assertParity(entries, ['foo.ts', 'foo.js', 'foo', `foo.ts${ending}`].map(file => path.join(base, file)))
  }
})

it('preserves lexical symlink bases and observes base retargeting without caching paths', () => {
  const root = temporaryRoot()
  const first = path.join(root, 'first')
  const second = path.join(root, 'second')
  for (const directory of [first, second]) {
    mkdirSync(directory)
    writeFileSync(path.join(directory, 'allowed.ts'), '')
  }
  const base = path.join(root, 'linked')
  const alias = path.join(root, 'alias')
  symlinkSync(first, base, 'junction')
  symlinkSync(first, alias, 'junction')
  const barriers = [entry(base, '**/foo'), entry(alias, '**/bar'), entry(base, path.join(first, 'blocked.ts')), entry(base, '**/baz')]
  expect(compactTailwindSourceEntries(barriers)).toEqual(barriers)
  const entries = [entry(base, '**/*', false), entry(base, '**/blocked.ts'), entry(base, '**/other.ts')]
  expect(match(compactTailwindSourceEntries(entries), path.join(first, 'allowed.ts'))).toBe(true)
  assertParity(entries, [path.join(first, 'allowed.ts'), path.join(second, 'allowed.ts')])
  unlinkSync(base)
  symlinkSync(second, base, 'junction')
  expect(match(compactTailwindSourceEntries(entries), path.join(first, 'allowed.ts'))).toBe(false)
  expect(match(compactTailwindSourceEntries(entries), path.join(second, 'allowed.ts'))).toBe(true)
  assertParity(entries, [path.join(first, 'allowed.ts'), path.join(second, 'allowed.ts')])
})

it('rechecks missing parent creation and file resolution through a retargeted directory', () => {
  const root = temporaryRoot()
  const base = path.join(root, 'src')
  const outside = path.join(root, 'outside')
  mkdirSync(base)
  mkdirSync(outside)
  const parent = path.join(base, 'late')
  const file = path.join(parent, 'allowed.ts')
  const entries = [entry(base, '**/*', false), entry(base, '**/blocked.ts'), entry(base, '**/other.ts')]
  expect(match(compactTailwindSourceEntries(entries), file)).toBe(true)
  assertParity(entries, [file])
  mkdirSync(parent)
  writeFileSync(file, '')
  expect(match(compactTailwindSourceEntries(entries), file)).toBe(true)
  assertParity(entries, [file])
  rmSync(parent, { recursive: true })
  writeFileSync(path.join(outside, 'allowed.ts'), '')
  symlinkSync(outside, parent, 'junction')
  expect(match(compactTailwindSourceEntries(entries), file)).toBe(false)
  assertParity(entries, [file])
})
