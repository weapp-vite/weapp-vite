import type { ViteDevServer } from 'vite'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { event, observeOutcome } from './support'

it('resolves public watcher notifications against its configured cwd', async () => {
  vi.useFakeTimers()
  const cwd = path.resolve('watcher-fixture')
  const watcher = Object.assign(new EventEmitter(), { options: { cwd } })
  const server = { watcher } as unknown as ViteDevServer
  try {
    const observing = observeOutcome(event(server, path.join(cwd, 'source.js'), async () => {
      watcher.emit('change', 'another.js')
      watcher.emit('change', 'source.js')
    }))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await observing).toEqual({ status: 'fulfilled', value: undefined })
    expect(watcher.eventNames()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  }
  finally {
    vi.useRealTimers()
  }
})
