import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveRealpath, withRealpathScope } from './realpathScope'

const directories: string[] = []

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'path-scope-'))
  directories.push(root)
  return root
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('synchronous path identity scope', () => {
  it('shares successful reads across nested traversals and releases on exception', () => {
    const root = fixture()
    const native = vi.spyOn(realpathSync, 'native')
    expect(() => withRealpathScope(() => {
      const first = resolveRealpath(root)
      expect(withRealpathScope(() => resolveRealpath(root))).toBe(first)
      expect(resolveRealpath(root)).toBe(first)
      expect(native).toHaveBeenCalledTimes(1)
      throw new Error('aborted traversal')
    })).toThrow('aborted traversal')
    resolveRealpath(root)
    expect(native).toHaveBeenCalledTimes(2)
  })

  it('never caches failed resolution, including creation in the same operation', () => {
    const file = path.join(fixture(), 'later.txt')
    withRealpathScope(() => {
      expect(() => resolveRealpath(file)).toThrow()
      writeFileSync(file, 'ready')
      expect(resolveRealpath(file)).toBe(realpathSync.native(file))
    })
  })

  it('observes symlink replacement between operations', () => {
    const root = fixture()
    const first = path.join(root, 'first')
    const second = path.join(root, 'second')
    const link = path.join(root, 'link')
    mkdirSync(first)
    mkdirSync(second)
    symlinkSync(first, link, 'junction')
    expect(withRealpathScope(() => resolveRealpath(link))).toBe(realpathSync.native(first))
    unlinkSync(link)
    symlinkSync(second, link, 'junction')
    expect(withRealpathScope(() => resolveRealpath(link))).toBe(realpathSync.native(second))
  })

  it('does not retain the synchronous scope during an async continuation', async () => {
    const root = fixture()
    const native = vi.spyOn(realpathSync, 'native')
    await withRealpathScope(async () => {
      resolveRealpath(root)
      await Promise.resolve()
      resolveRealpath(root)
      resolveRealpath(root)
    })
    expect(native).toHaveBeenCalledTimes(3)
  })
})
