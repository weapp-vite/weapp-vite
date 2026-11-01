import type { ViteDevServer } from 'vite'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { deferWatcherResourceCleanup } from '../runtime/watcherPlugin'
import { WeappBuildSession } from './session'

it('closes once and waits for a pending entry scan before releasing owned resources', async () => {
  const session = new WeappBuildSession()
  const released = vi.fn()
  deferWatcherResourceCleanup(session.context.watcherService, released)
  session.state = 'ready'
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  vi.spyOn(session.context.scanService, 'loadAppEntry').mockImplementation(async () => {
    await pending
    return { json: { pages: [] } } as Awaited<ReturnType<typeof session.context.scanService.loadAppEntry>>
  })
  const validation = session.validateEntries()
  const rejected = expect(validation).rejects.toThrow('已关闭')
  const closing = session.close()
  expect(session.close()).toBe(closing)
  await Promise.resolve()
  expect(released).not.toHaveBeenCalled()
  expect(session.state).toBe('closing')
  finish()
  await rejected
  await closing
  expect(released).toHaveBeenCalledOnce()
  expect(session.state).toBe('closed')
})

it('releases only its own resources and reaches closed even when cleanup rejects', async () => {
  const first = new WeappBuildSession()
  const second = new WeappBuildSession()
  const secondCleanup = vi.fn()
  deferWatcherResourceCleanup(first.context.watcherService, () => {
    throw new Error('cleanup failed')
  })
  deferWatcherResourceCleanup(second.context.watcherService, secondCleanup)
  await expect(first.close()).rejects.toThrow('resource cleanup failed')
  expect(first.state).toBe('closed')
  expect(second.state).toBe('created')
  expect(secondCleanup).not.toHaveBeenCalled()
  await second.close()
  expect(secondCleanup).toHaveBeenCalledOnce()
})

it('rejects starting an already closed session before creating registration observers', async () => {
  const session = new WeappBuildSession()
  await session.close()
  await expect(session.startDev({} as ViteDevServer)).rejects.toThrow('已关闭')
})

it('cancels registration before waiting for in-flight startup on close', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'host-startup-registration-'))
  const session = new WeappBuildSession()
  session.state = 'ready'
  session.isWeb = true
  const getWatched = vi.fn(() => ({}))
  const watcher = Object.assign(new EventEmitter(), { options: {}, getWatched })
  const server = { watcher, config: { root, server: { watch: {} }, experimental: {} } } as unknown as ViteDevServer
  try {
    await writeFile(path.join(root, 'entry.js'), 'export {}')
    const startup = session.startDev(server)
    await vi.waitFor(() => expect(getWatched).toHaveBeenCalled())
    await session.close()
    await startup
    expect(session.state).toBe('closed')
    expect(watcher.listenerCount('error')).toBe(0)
  }
  finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})
