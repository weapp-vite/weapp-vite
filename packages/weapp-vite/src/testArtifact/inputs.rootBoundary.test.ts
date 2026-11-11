import fs from 'node:fs/promises'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fingerprintPaths } from './inputs'

const state = vi.hoisted(() => ({
  flavor: 'posix' as 'posix' | 'win32',
  directories: new Map<string, string[]>(),
  files: new Map<string, string>(),
  aliases: new Map<string, string>(),
}))

vi.mock('node:path', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:path')>()
  return {
    ...original,
    default: new Proxy(original.default, {
      get(_target, key) {
        return Reflect.get(original[state.flavor], key)
      },
    }),
  }
})

vi.mock('node:fs/promises', () => ({
  default: {
    stat: vi.fn(async (file: string) => {
      if (!state.directories.has(file) && !state.files.has(file)) {
        throw Object.assign(new Error(`Access denied: ${file}`), { code: 'EPERM' })
      }
      return { isDirectory: () => state.directories.has(file) }
    }),
    realpath: vi.fn(async (file: string) => state.aliases.get(file) ?? file),
    readdir: vi.fn(async (file: string) => state.directories.get(file)!.map(name => ({ name }))),
    readFile: vi.fn(async (file: string) => state.files.get(file)),
  },
}))

beforeEach(() => {
  state.directories.clear()
  state.files.clear()
  state.aliases.clear()
  vi.clearAllMocks()
})

describe.each([
  ['posix', '/'],
  ['win32', 'D:\\'],
  ['win32', '\\\\server\\share\\'],
] as const)('test artifact %s filesystem root %s', (flavor, root) => {
  beforeEach(() => {
    state.flavor = flavor
    state.directories.set(root, ['protected', 'project'])
  })

  it('tracks root membership without reading descendants and retains explicit source content fingerprints', async () => {
    const source = path.join(root, 'project/src')
    const page = path.join(source, 'page.ts')
    state.directories.set(source, ['page.ts'])
    state.files.set(page, 'one')
    const inputs = [root, source]
    const initial = await fingerprintPaths(inputs)

    state.directories.set(root, ['project', 'protected'])
    expect(await fingerprintPaths(inputs)).toBe(initial)
    state.directories.set(root, ['project', 'protected', 'added'])
    expect(await fingerprintPaths(inputs)).not.toBe(initial)
    state.directories.set(root, ['project', 'protected'])
    expect(await fingerprintPaths(inputs)).toBe(initial)

    state.files.set(page, 'two')
    expect(await fingerprintPaths(inputs)).not.toBe(initial)
    expect(fs.stat).not.toHaveBeenCalledWith(path.join(root, 'protected'))
    expect(fs.stat).not.toHaveBeenCalledWith(path.join(root, 'project'))
    expect(fs.readFile).toHaveBeenCalledWith(page)
  })

  it('applies the same boundary to aliases resolving to a filesystem root', async () => {
    const alias = path.join(root, 'root-alias')
    state.directories.set(alias, ['protected', 'project'])
    state.aliases.set(alias, root)
    await expect(fingerprintPaths([alias])).resolves.toEqual(expect.any(String))
    expect(fs.stat).toHaveBeenCalledExactlyOnceWith(alias)
    expect(fs.readdir).toHaveBeenCalledExactlyOnceWith(alias, { withFileTypes: true })
  })

  it('keeps excluded output and dependency directories out of root membership fingerprints', async () => {
    const excluded = [path.join(root, 'generated')]
    const initial = await fingerprintPaths([root], excluded)
    state.directories.set(root, ['protected', 'project', 'generated', 'node_modules'])
    expect(await fingerprintPaths([root], excluded)).toBe(initial)
  })

  it('still rejects inaccessible explicitly registered dependencies', async () => {
    await expect(fingerprintPaths([path.join(root, 'protected')])).rejects.toMatchObject({ code: 'EPERM' })
  })
})
