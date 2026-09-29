import type { ViteDevServer } from 'vite'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { observeIndependentSources } from './independentSources'

it('tracks child dependencies and topology without closing or unwatching host resources', () => {
  const watcher = Object.assign(new EventEmitter(), { add: vi.fn(), unwatch: vi.fn(), close: vi.fn() })
  const server = { watcher } as unknown as ViteDevServer
  const change = vi.fn()
  const external = path.resolve('fixture/shared.ts')
  const root = path.resolve('fixture/independent')
  const observer = observeIndependentSources(server, change)
  observer.adopt({ files: [external], roots: [root] })
  watcher.emit('all', 'change', external)
  watcher.emit('all', 'add', path.join(root, 'new.vue'))
  watcher.emit('all', 'change', `${root}-other/page.vue`)
  expect(change).toHaveBeenCalledTimes(2)
  observer.adopt({ files: [], roots: [] })
  watcher.emit('all', 'change', external)
  expect(change).toHaveBeenCalledTimes(2)
  observer.close()
  expect(watcher.listenerCount('all')).toBe(0)
  expect(watcher.unwatch).not.toHaveBeenCalled()
  expect(watcher.close).not.toHaveBeenCalled()
})
