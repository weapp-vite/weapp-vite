import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'
import { absolutePath, normalizeNativeWatchPath } from './support.mjs'

it.each([
  [String.raw`\\?\C:\fixture\entry.ts`, String.raw`C:\fixture\entry.ts`],
  [String.raw`\\?\UNC\server\share\entry.ts`, String.raw`\\server\share\entry.ts`],
])('observes the same logical Windows path for %s', (native, logical) => {
  expect(normalizeNativeWatchPath(native)).toBe(logical)
  expect(path.win32.relative(path.win32.dirname(logical), normalizeNativeWatchPath(native))).toBe('entry.ts')
})

it('preserves case and ordinary paths without rewriting caller-owned error fields', () => {
  const input = String.raw`\\?\C:\Fixture\Entry.ts`
  const error = Object.assign(new Error('original watch error'), { path: input })
  expect(normalizeNativeWatchPath(error.path)).toBe(String.raw`C:\Fixture\Entry.ts`)
  expect(error.path).toBe(input)
  expect(normalizeNativeWatchPath('src/Entry.ts')).toBe('src/Entry.ts')
})

it('resolves local URL and relative inputs using the real host path rules', () => {
  const file = path.join(tmpdir(), 'watch-path-fixture', 'entry.ts')
  expect(absolutePath(pathToFileURL(file))).toBe(file)
  expect(absolutePath('src/entry.ts')).toBe(path.resolve('src/entry.ts'))
})
