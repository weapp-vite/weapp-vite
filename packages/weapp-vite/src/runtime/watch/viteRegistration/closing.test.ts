import type { ViteDevServer } from 'vite'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createViteInputRegistration } from './index'

const mocks = vi.hoisted(() => ({ lstat: vi.fn(), readdir: vi.fn(), realpath: vi.fn(), stat: vi.fn() }))
vi.mock('node:fs/promises', () => mocks)

it('waits for an admitted scan and preserves its original read error after cancellation', async () => {
  const read = Promise.withResolvers<never>()
  mocks.lstat.mockReturnValue(read.promise)
  const root = path.resolve('registration-fixture')
  const watcher = Object.assign(new EventEmitter(), { options: {}, getWatched: () => ({}) })
  const server = { watcher, config: { root, server: { watch: {} }, experimental: {} } } as unknown as ViteDevServer
  const registration = createViteInputRegistration(server, [root])
  const closing = registration.close()
  let closed = false
  void closing.then(() => {
    closed = true
  }, () => {
    closed = true
  })
  await expect(registration.ready).resolves.toBe('closed')
  expect(closed).toBe(false)
  const error = Object.assign(new Error('source scan permission failed'), { code: 'EACCES' })
  const failed = expect(closing).rejects.toBe(error)
  read.reject(error)
  await failed
  await expect(registration.close()).rejects.toBe(error)
  expect(watcher.listenerCount('error')).toBe(0)
})
