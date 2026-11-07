import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { collectProjectConfigAssets } from './projectConfigOutput'

const io = vi.hoisted(() => ({ before: vi.fn(async (_operation: string, _file: unknown) => {}) }))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    async realpath(...args: Parameters<typeof actual.realpath>) {
      await io.before('realpath', args[0])
      return actual.realpath(...args)
    },
    async readdir(...args: Parameters<typeof actual.readdir>) {
      await io.before('readdir', args[0])
      return actual.readdir(...args)
    },
    async readFile(...args: Parameters<typeof actual.readFile>) {
      await io.before('readFile', args[0])
      return actual.readFile(...args)
    },
  }
})

const roots: string[] = []
beforeEach(() => io.before.mockReset())
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-project-config-output-'))
  roots.push(root)
  const source = path.join(root, 'config')
  const output = path.join(root, 'output')
  const nested = path.join(source, 'nested')
  const extra = path.join(source, 'extra.json')
  await mkdir(nested, { recursive: true })
  await writeFile(extra, '{"extra":true}')
  await writeFile(path.join(source, 'keep.json'), '{"keep":true}')
  await writeFile(path.join(nested, 'settings.json'), '{"nested":true}')
  return { source, nested, extra, collect: (watch: (file: string) => void = () => {}) => collectProjectConfigAssets(source, output, path.join(output, 'dist'), watch) }
}

describe('project config collection', () => {
  it('collects existing files and registers each directory and file', async () => {
    const { source, collect } = await fixture()
    const watch = vi.fn()
    const assets = await collect(watch)
    expect(Object.fromEntries(assets.map(asset => [asset.fileName, asset.source.toString()]))).toEqual({
      'extra.json': '{"extra":true}',
      'keep.json': '{"keep":true}',
      'nested/settings.json': '{"nested":true}',
    })
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    const realSource = path.normalize(await actual.realpath(source))
    expect(watch.mock.calls.map(([file]) => path.relative(realSource, file)).sort()).toEqual([
      '',
      'extra.json',
      'keep.json',
      'nested',
      'nested/settings.json',
    ])
  })

  it.each(['realpath', 'readFile', 'readdir'])('omits an enumerated child removed before %s', async (operation) => {
    const { nested, extra, collect } = await fixture()
    const target = operation === 'readdir' ? nested : extra
    io.before.mockImplementation(async (next, file) => {
      if (next === operation && file === target) {
        await rm(target, { recursive: true })
      }
    })
    const assets = await collect()
    expect(assets.map(asset => asset.fileName).sort()).toEqual(operation === 'readdir'
      ? ['extra.json', 'keep.json']
      : ['keep.json', 'nested/settings.json'])
  })

  it.each(['realpath', 'readFile', 'readdir'])('omits an enumerated child whose parent stops being a directory before %s', async (operation) => {
    const { nested, extra, collect } = await fixture()
    const target = operation === 'readdir' ? nested : extra
    io.before.mockImplementation(async (next, file) => {
      if (next === operation && file === target) {
        throw Object.assign(new Error('parent is no longer a directory'), { code: 'ENOTDIR' })
      }
    })
    const assets = await collect()
    expect(assets.map(asset => asset.fileName).sort()).toEqual(operation === 'readdir'
      ? ['extra.json', 'keep.json']
      : ['keep.json', 'nested/settings.json'])
  })

  it.each(['realpath', 'readFile', 'readdir'])('preserves non-missing %s errors', async (operation) => {
    const { nested, extra, collect } = await fixture()
    const target = operation === 'readdir' ? nested : extra
    const error = Object.assign(new Error('cannot read config'), { code: operation === 'readFile' ? 'EIO' : 'EACCES' })
    io.before.mockImplementation(async (next, file) => {
      if (next === operation && file === target) {
        throw error
      }
    })
    await expect(collect()).rejects.toBe(error)
  })

  it.each(['realpath', 'readdir'])('rejects a missing source root during %s', async (operation) => {
    const { source, collect } = await fixture()
    io.before.mockImplementation(async (next, file) => {
      if (next === operation && file === source) {
        await rm(source, { recursive: true })
      }
    })
    await expect(collect()).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves missing-path errors thrown by a watch callback for a child', async () => {
    const { extra, collect } = await fixture()
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    const realExtra = path.normalize(await actual.realpath(extra))
    const error = Object.assign(new Error('watch registration failed'), { code: 'ENOENT' })
    await expect(collect((file) => {
      if (file === realExtra) {
        throw error
      }
    })).rejects.toBe(error)
  })
})
