import type { Stats } from 'node:fs'
import type { ViteDevServer } from 'vite'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createViteInputRegistration } from './index'

const mocks = vi.hoisted(() => ({ lstat: vi.fn(), readdir: vi.fn(), realpath: vi.fn(), stat: vi.fn() }))
vi.mock('node:fs/promises', () => mocks)

const cleanups: Array<() => Promise<void>> = []
beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
})
afterEach(async () => {
  for (const close of cleanups.splice(0)) {
    await close()
  }
  vi.useRealTimers()
})

function setup(ignored: ViteDevServer['watcher']['options']['ignored']) {
  const root = path.resolve('registration-ignore-fixture')
  const generated = path.join(root, 'generated')
  const entries = new Map([
    [root, ['entry.js', 'ignored.js', 'keep.generated.js', 'generated']],
    [generated, ['output.js']],
  ])
  const directoryStats = { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false } as Stats
  const fileStats = { isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false } as Stats
  mocks.lstat.mockImplementation(async file => entries.has(file) ? directoryStats : fileStats)
  mocks.readdir.mockImplementation(async file => entries.get(file) ?? [])
  mocks.realpath.mockImplementation(async file => file)
  const watched: Record<string, string[]> = { '.': ['entry.js', 'ignored.js', 'keep.generated.js'] }
  const watcher = Object.assign(new EventEmitter(), {
    options: { cwd: root, ignored },
    getWatched: () => watched,
  })
  const server = { watcher, config: { root, server: { watch: watcher.options }, experimental: {} } } as unknown as ViteDevServer
  return { root, generated, watched, watcher, server }
}

async function expectRegistered(server: ViteDevServer) {
  const registration = createViteInputRegistration(server, [server.config.root])
  cleanups.push(registration.close)
  let state: string | undefined
  void registration.ready.then(value => state = value)
  await vi.advanceTimersByTimeAsync(0)
  expect(state).toBe('registered')
  expect(server.watcher.listenerCount('error')).toBe(0)
}

it('does not wait for an absolute ignored directory when the watcher uses cwd', async () => {
  const root = path.resolve('registration-ignore-fixture')
  const { server, generated } = setup(path.join(root, 'generated'))
  await expectRegistered(server)
  expect(mocks.readdir).not.toHaveBeenCalledWith(generated)
})

it('passes absolute paths and stats to ignored callbacks when the watcher uses cwd', async () => {
  const root = path.resolve('registration-ignore-fixture')
  const ignored = vi.fn((file: string, stats?: Stats) => file === path.join(root, 'generated') && stats?.isDirectory() === true)
  const { server, generated } = setup(ignored)
  await expectRegistered(server)
  expect(ignored).toHaveBeenCalledWith(generated, expect.objectContaining({ isDirectory: expect.any(Function) }))
  expect(mocks.readdir).not.toHaveBeenCalledWith(generated)
})

it('normalizes negative text with cwd before interpreting ignored rules', async () => {
  const { server, watched } = setup(['**/*.js', '!**/keep.generated.js'])
  watched['.'] = []
  await expectRegistered(server)
})
