import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createPackageImportsCache } from './packageCache'

describe('package imports session cache', () => {
  it('shares package reads, watches missing nearer boundaries and reloads after invalidation', async () => {
    const directory = path.resolve('imports-fixture')
    const nested = path.join(directory, 'src')
    const manifest = path.join(directory, 'package.json')
    const nearerManifest = path.join(nested, 'package.json')
    const files = new Map<string, unknown>([[manifest, { name: 'outer' }]])
    const read = vi.fn(async (file: string) => files.get(file))
    const cache = createPackageImportsCache(read)
    const first = await cache.find(nested)
    expect(first).toEqual({ candidates: [nearerManifest, manifest], package: { file: manifest, data: { name: 'outer' } } })
    expect(await cache.find(nested)).toBe(first)
    expect(read).toHaveBeenCalledTimes(2)
    files.set(nearerManifest, { name: 'inner' })
    cache.clear()
    expect((await cache.find(nested)).package?.data.name).toBe('inner')
    files.delete(nearerManifest)
    cache.clear()
    expect((await cache.find(nested)).package?.data.name).toBe('outer')
  })

  it('does not restore a stale pending lookup after its generation is cleared', async () => {
    const directory = path.resolve('imports-race-fixture')
    let finish!: (data: unknown) => void
    const read = vi.fn().mockImplementationOnce(() => new Promise(resolve => finish = resolve)).mockResolvedValue({ name: 'current' })
    const cache = createPackageImportsCache(read)
    const first = cache.find(directory)
    await Promise.resolve()
    cache.clear()
    const current = await cache.find(directory)
    finish({ name: 'stale' })
    expect(current.package?.data.name).toBe('current')
    expect((await first).package?.data.name).toBe('current')
    expect(await cache.find(directory)).toBe(current)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('ignores unreadable and non-object package files like the native nearest-package lookup', async () => {
    const directory = path.resolve('imports-invalid-fixture')
    const nested = path.join(directory, 'src', 'nested')
    const read = vi.fn(async (file: string) => {
      if (file === path.join(nested, 'package.json')) {
        throw new Error('invalid package JSON')
      }
      if (file === path.join(directory, 'src', 'package.json')) {
        return []
      }
      return { name: 'outer' }
    })
    const cache = createPackageImportsCache(read)
    expect((await cache.find(nested)).package).toEqual({ file: path.join(directory, 'package.json'), data: { name: 'outer' } })
  })

  it('does not share cached package data between factories', async () => {
    const directory = path.resolve('imports-independent-fixture')
    const read = vi.fn().mockResolvedValueOnce({ name: 'first' }).mockResolvedValueOnce({ name: 'second' })
    const first = createPackageImportsCache(read)
    const second = createPackageImportsCache(read)
    expect((await first.find(directory)).package?.data.name).toBe('first')
    expect((await second.find(directory)).package?.data.name).toBe('second')
    expect(read).toHaveBeenCalledTimes(2)
  })
})
