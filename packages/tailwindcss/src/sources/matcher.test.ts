import type { CompilerGenerateResult } from 'weapp-tailwindcss/core'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isFileMatchedByTailwindV4SourceEntries } from '@weapp-tailwindcss/engine'
// eslint-disable-next-line e18e/ban-dependencies -- 对照已安装上游使用的 glob 编译器，验证首轮编译次数。
import micromatch from 'micromatch'
import { afterEach, expect, it, vi } from 'vitest'
import { createTailwindSourceMatcher } from './matcher'

type SourceEntry = CompilerGenerateResult['sources'][number]
const directories: string[] = []

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function temporaryRoot() {
  const root = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'tailwind-matcher-')))
  directories.push(root)
  return root
}

function entry(base: string, pattern: string, negated = false): SourceEntry {
  return { base, pattern, negated }
}

function assertParity(entries: SourceEntry[], files: string[]) {
  const matches = createTailwindSourceMatcher(isFileMatchedByTailwindV4SourceEntries)
  for (const file of files) {
    expect(matches(file, entries), file).toBe(isFileMatchedByTailwindV4SourceEntries(file, entries))
  }
}

const patterns = ['**/.git/**', '**/.hg/**', '**/node_modules/**', '**/*.scss', '**/*.lock', '**/pnpm-lock.yaml', '**/.env.*', '**/tailwind.config.*.ts']
const files = ['', '.', '..', 'index.ts', 'index.json', 'styles.scss', 'nested/styles.scss', '.foo.scss', '.config.ts', '.env', '.env.local', 'nested/.env.local', '.git', '.git/config', '.gitignore', '.hidden/index.ts', '.hidden/.foo.scss', 'node_modules', 'node_modules/file.js', 'a/b/node_modules/deeper/file.js', 'pnpm-lock.yaml', 'tailwind.config.prod.ts']

it('matches the installed upstream for hidden files, relative scopes and complex glob syntax', () => {
  const base = temporaryRoot()
  const entries = [entry(base, '**/*'), ...patterns.map(pattern => entry(base, pattern, true))]
  assertParity(entries, files.map(file => path.resolve(base, file)))
  for (const pattern of ['**/.*', '**/.hidden/**', '**/[ab].ts', '**/!(ignored)/**', '**/*.{ts,js}', './*.ts', path.join(base, '*.ts')]) {
    assertParity([entry(base, pattern), ...entries], files.map(file => path.resolve(base, file)))
  }
  assertParity([entry(path.relative(process.cwd(), base), '**/*')], files.map(file => path.resolve(base, file)))
})

// 代表路径只覆盖字符串语义；不能替代 Windows 文件系统和正式平台验收。
it.each(['C:\\project\\src', 'C:/project/src', '\\\\server\\share\\src', '//server/share/src'])('preserves upstream Windows and mixed path API selection: %s', (base) => {
  const entries = [entry(base, '**/*'), ...patterns.map(pattern => entry(base, pattern, true)), entry('/other/src', '**/*.ts')]
  assertParity(entries, files.map(file => path.win32.resolve(base, file)))
  assertParity([entry(base, path.win32.join(base, '*.ts')), entry('/other/src', '**/*.ts')], [path.win32.join(base, 'index.ts'), '/other/src/index.ts'])
})

it('preserves upstream drive-relative paths and POSIX pattern backslashes', () => {
  for (const base of ['C:src', 'C:src\\nested']) {
    assertParity([entry(base, '**/*.ts'), entry('/other/src', '**/*.ts')], ['C:src/index.ts', 'C:src\\nested\\index.ts', 'C:file.ts', '/other/src/index.ts'])
    assertParity([entry(base, 'C:src/*.ts')], ['C:src/index.ts', 'C:file.ts'])
  }
  assertParity([entry('/project/src', '**/foo\\bar.ts')], ['/project/src/foo\\bar.ts', '/project/src/foobar.ts', '/project/src/foo/bar.ts'])
})

it('keeps upstream empty and negative-only helper contracts', () => {
  const base = temporaryRoot()
  assertParity([], [path.join(base, 'file.ts')])
  assertParity([entry(base, '**/*.ts', true)], [path.join(base, 'file.ts'), path.join(base, 'file.js')])
})

it('compiles only reached patterns after relative containment and preserves ordered errors', () => {
  const base = temporaryRoot()
  const invalid = '*'.repeat(65537)
  const matches = createTailwindSourceMatcher(isFileMatchedByTailwindV4SourceEntries)
  const blocked = path.join(base, 'blocked.ts')
  expect(matches(blocked, [entry(base, '**/*'), entry(base, invalid)])).toBe(true)
  expect(matches(blocked, [entry(base, '*.wxml'), entry(base, invalid, true)])).toBe(false)
  expect(matches(blocked, [entry(base, '**/*'), entry(base, '**/blocked.ts', true), entry(base, invalid, true)])).toBe(false)
  expect(() => matches(path.join(base, 'unblocked.ts'), [entry(base, '**/*'), entry(base, '**/blocked.ts', true), entry(base, invalid, true)])).toThrow()
  expect(matches(path.join(base, 'index.ts'), [entry(path.join(base, 'outside'), invalid)])).toBe(false)
  expect(matches(base, [entry(base, invalid)])).toBe(false)
})

it('reads current plain fields each file while reusing only compiled patterns', () => {
  const base = temporaryRoot()
  const entries = [entry(base, '**/*'), entry(base, '**/blocked.ts', true)]
  const matches = createTailwindSourceMatcher(isFileMatchedByTailwindV4SourceEntries)
  const first = path.join(base, 'first.ts')
  expect(matches(first, entries)).toBe(true)
  entries[1]!.pattern = '**/*.ts'
  expect(matches(first, entries)).toBe(false)
  entries[1]!.base = path.join(base, 'outside')
  expect(matches(first, entries)).toBe(true)
  entries[1]!.base = base
  entries[1]!.negated = false
  expect(matches(first, entries)).toBe(true)
  expect(entries).toHaveLength(2)
})

it.each(['\n', '\r', '\r\n'])('keeps trailing line endings and parent-like names: %j', (ending) => {
  const base = temporaryRoot()
  assertParity([entry(base, '**/*'), entry(base, `**/*.ts${ending}`, true)], ['..foo', 'file.ts', `file.ts${ending}`].map(file => path.join(base, file)))
  assertParity([entry(base, '**/.*')], [path.dirname(base), path.join(base, '..foo')])
})

it('delegates accessor and Proxy entries without additional field reads', () => {
  const base = temporaryRoot()
  const file = path.join(base, 'file.ts')
  for (const proxy of [false, true]) {
    const calls: string[] = []
    const source = proxy
      ? new Proxy(entry(base, '**/*'), {
          get(target, key, receiver) {
            calls.push(String(key))
            return Reflect.get(target, key, receiver)
          },
        })
      : {
          get base() {
            calls.push('base')
            return base
          },
          get pattern() {
            calls.push('pattern')
            return '**/*'
          },
          get negated() {
            calls.push('negated')
            return false
          },
        }
    const entries = [source]
    const expected = isFileMatchedByTailwindV4SourceEntries(file, entries)
    const originalCalls = [...calls]
    calls.length = 0
    const original = vi.fn(isFileMatchedByTailwindV4SourceEntries)
    expect(createTailwindSourceMatcher(original)(file, entries)).toBe(expected)
    expect(calls).toEqual(originalCalls)
    expect(original).toHaveBeenCalledOnce()
  }
})

it.each(['extra', Symbol('extra')])('does not read additional enumerable accessors during compaction: %s', (key) => {
  const base = temporaryRoot()
  const source = entry(base, '**/blocked.ts', true)
  const get = vi.fn(() => {
    throw new Error('unrelated field')
  })
  Object.defineProperty(source, key, { enumerable: true, get })
  const entries = [entry(base, '**/*'), source, entry(base, '**/other.ts', true)]
  const original = vi.fn(isFileMatchedByTailwindV4SourceEntries)
  expect(createTailwindSourceMatcher(original)(path.join(base, 'allowed.ts'), entries)).toBe(true)
  expect(get).not.toHaveBeenCalled()
  expect(original).toHaveBeenCalledOnce()
})

it('delegates Proxy arrays and overridden array methods without additional reads', () => {
  const base = temporaryRoot()
  const file = path.join(base, 'file.ts')
  for (const proxy of [false, true]) {
    const calls: string[] = []
    const sources = [entry(base, '**/*')]
    const entries = proxy
      ? new Proxy(sources, {
          get(target, key, receiver) {
            calls.push(String(key))
            return Reflect.get(target, key, receiver)
          },
        })
      : sources
    if (!proxy) {
      Object.defineProperty(entries, 'map', {
        get() {
          calls.push('map')
          return Array.prototype.map
        },
      })
    }
    const expected = isFileMatchedByTailwindV4SourceEntries(file, entries)
    const originalCalls = [...calls]
    calls.length = 0
    const original = vi.fn(isFileMatchedByTailwindV4SourceEntries)
    expect(createTailwindSourceMatcher(original)(file, entries)).toBe(expected)
    expect(calls).toEqual(originalCalls)
    expect(original).toHaveBeenCalledOnce()
  }
})

it('delegates revoked Proxy arrays before inspecting their array shape', () => {
  const { proxy, revoke } = Proxy.revocable([entry('/project/src', '**/*')], {})
  revoke()
  const original = vi.fn(isFileMatchedByTailwindV4SourceEntries)
  expect(() => createTailwindSourceMatcher(original)('/project/src/file.ts', proxy)).toThrow(TypeError)
  expect(original).toHaveBeenCalledOnce()
})

it('resolves a symlink base freshly after a matching-file callback retargets it', () => {
  const root = temporaryRoot()
  const first = path.join(root, 'first')
  const second = path.join(root, 'second')
  for (const directory of [first, second]) {
    mkdirSync(directory)
    writeFileSync(path.join(directory, 'allowed.ts'), '')
  }
  const linked = path.join(root, 'linked')
  symlinkSync(first, linked, 'junction')
  const entries = [entry(linked, '**/*'), entry(linked, '**/blocked.ts', true)]
  const matches = createTailwindSourceMatcher(isFileMatchedByTailwindV4SourceEntries)
  const calls: string[] = []
  const callback = (file: string) => {
    if (matches(file, entries)) {
      calls.push(file)
      if (calls.length === 1) {
        unlinkSync(linked)
        symlinkSync(second, linked, 'junction')
      }
    }
  }
  callback(path.join(first, 'allowed.ts'))
  callback(path.join(first, 'allowed.ts'))
  callback(path.join(second, 'allowed.ts'))
  expect(calls).toEqual([path.join(first, 'allowed.ts'), path.join(second, 'allowed.ts')])
  assertParity(entries, [path.join(first, 'allowed.ts'), path.join(second, 'allowed.ts')])
})

it('rechecks a missing parent and a source path retargeted between files', () => {
  const root = temporaryRoot()
  const base = path.join(root, 'src')
  const outside = path.join(root, 'outside')
  mkdirSync(base)
  mkdirSync(outside)
  const parent = path.join(base, 'late')
  const file = path.join(parent, 'allowed.ts')
  const entries = [entry(base, '**/*'), entry(base, '**/blocked.ts', true)]
  const matches = createTailwindSourceMatcher(isFileMatchedByTailwindV4SourceEntries)
  expect(matches(file, entries)).toBe(true)
  mkdirSync(parent)
  writeFileSync(file, '')
  expect(matches(file, entries)).toBe(true)
  rmSync(parent, { recursive: true })
  writeFileSync(path.join(outside, 'allowed.ts'), '')
  symlinkSync(outside, parent, 'junction')
  expect(matches(file, entries)).toBe(false)
  assertParity(entries, [file])
})

it('reduces first cold file base realpath calls and compiles repeated patterns once', () => {
  const base = temporaryRoot()
  const candidates = ['index.wxml', 'index.json', 'index.js'].map(file => path.join(base, file))
  for (const file of candidates) {
    writeFileSync(file, '')
  }
  const entries = [entry(base, '**/*'), ...patterns.map(pattern => entry(base, pattern, true))]
  const native = vi.spyOn(realpathSync, 'native')
  const original = candidates.map(file => isFileMatchedByTailwindV4SourceEntries(file, entries))
  const originalBaseCalls = native.mock.calls.filter(([file]) => file === base).length
  native.mockClear()
  const compiled = vi.spyOn(micromatch, 'matcher')
  const matches = createTailwindSourceMatcher(isFileMatchedByTailwindV4SourceEntries)
  const first = matches(candidates[0]!, entries)
  expect(native.mock.calls.filter(([file]) => file === base)).toHaveLength(1)
  expect(compiled).toHaveBeenCalled()
  const initialCompilations = compiled.mock.calls.length
  const actual = [first, ...candidates.slice(1).map(file => matches(file, entries))]
  expect(actual).toEqual(original)
  expect(native.mock.calls.filter(([file]) => file === base)).toHaveLength(candidates.length)
  expect(native.mock.calls.filter(([file]) => file === base).length).toBeLessThan(originalBaseCalls)
  expect(compiled.mock.calls).toHaveLength(initialCompilations)
})
