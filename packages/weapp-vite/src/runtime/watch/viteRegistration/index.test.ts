import type { ViteDevServer } from 'vite'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createViteInputRegistration } from './index'

const cleanups: Array<() => void | Promise<void>> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
})

async function setup(options: ViteDevServer['watcher']['options'] = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vite-registration-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  const watched: Record<string, string[]> = {}
  const watcher = Object.assign(new EventEmitter(), { options, getWatched: () => watched })
  const server = { watcher, config: { root, server: { watch: options }, experimental: {} } } as unknown as ViteDevServer
  return { root, watcher, watched, server }
}

function start(server: ViteDevServer, roots: string[]) {
  const registration = createViteInputRegistration(server, roots)
  cleanups.push(registration.close)
  return registration
}

it('keeps admission pending after an early ready until existing source paths are registered', async () => {
  const { root, watcher, watched, server } = await setup()
  await writeFile(path.join(root, 'entry.js'), 'export const value = 1')
  const registration = start(server, [root])
  let settled = false
  void registration.ready.then(() => {
    settled = true
  })
  watcher.emit('ready')
  await new Promise(resolve => setTimeout(resolve, 25))
  expect(settled).toBe(false)
  watched[root] = ['entry.js']
  await expect(registration.ready).resolves.toBe('registered')
  expect(watcher.listenerCount('error')).toBe(0)
})

it('uses effective ignored rules and watcher-root depth without admitting ignored descendants', async () => {
  const { root, server } = await setup({ depth: 0, ignored: ['**/generated/**'] })
  await mkdir(path.join(root, 'src/generated'), { recursive: true })
  await writeFile(path.join(root, 'src/entry.js'), 'export {}')
  await writeFile(path.join(root, 'src/generated/output.js'), 'generated')
  await expect(start(server, [path.join(root, 'src')]).ready).resolves.toBe('registered')
})

it('keeps editor temporary files outside registration when atomic watching ignores them', async () => {
  const { root, watched, server } = await setup({ atomic: true })
  for (const name of ['entry.js', '.entry.js.swp', '.entry.js.swx', 'entry.js~', '.entry.subl-save.tmp']) {
    await writeFile(path.join(root, name), 'source')
  }
  watched[root] = ['entry.js']
  await expect(start(server, [root]).ready).resolves.toBe('registered')
})

it('preserves cwd-relative getWatched paths', async () => {
  const { root, watched, server } = await setup()
  server.watcher.options = { cwd: root }
  await writeFile(path.join(root, 'entry.js'), 'export {}')
  watched['.'] = ['entry.js']
  await expect(start(server, [root]).ready).resolves.toBe('registered')
})

it('cancels pending registration on generation close and preserves watcher error identity', async () => {
  const { root, watcher, server } = await setup()
  await writeFile(path.join(root, 'entry.js'), 'export {}')
  const first = start(server, [root])
  first.close()
  first.close()
  await expect(first.ready).resolves.toBe('closed')
  const second = start(server, [root])
  const error = new Error('source registration failed')
  const rejected = expect(second.ready).rejects.toBe(error)
  watcher.emit('error', error)
  await rejected
  expect(watcher.listenerCount('error')).toBe(0)
})

it('does not scan disabled watchers or sources owned by bundled development', async () => {
  const { root, server } = await setup()
  const getWatched = vi.spyOn(server.watcher, 'getWatched')
  server.config.server.watch = null
  await expect(start(server, [root]).ready).resolves.toBe('registered')
  server.config.server.watch = {}
  server.config.experimental.bundledDev = true
  await expect(start(server, [root]).ready).resolves.toBe('registered')
  expect(getWatched).not.toHaveBeenCalled()
})
