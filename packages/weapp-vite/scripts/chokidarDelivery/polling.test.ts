import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { pollingHostHandoff } from './probe/polling.mjs'

const harness = vi.hoisted(() => ({
  createServer: vi.fn(),
  initializationError: new Error('stop before acquiring a host watcher'),
}))

vi.mock('vite', () => ({ createServer: harness.createServer }))
vi.mock('weapp-vite/vite', () => ({ weapp: () => ({ name: 'mock:weapp' }) }))
vi.mock('./probe/fixture.mjs', () => ({ weappOptions: {} }))
vi.mock('./probe/public.mjs', () => ({ assertOutput: vi.fn(), closeOwner: vi.fn() }))
vi.mock('node:fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

it('polling 交接仅关闭 WebSocket，保留 classic 所需的 hotUpdate 事件入口', async () => {
  harness.createServer.mockRejectedValueOnce(harness.initializationError)
  await expect(pollingHostHandoff({
    root: path.resolve('fixture'),
    owners: [],
    errors: [],
    instrumentation: { pollingHandles: [] },
    evidence: {},
  })).rejects.toBe(harness.initializationError)
  expect(harness.createServer).toHaveBeenCalledOnce()
  const config = harness.createServer.mock.calls[0]![0]
  expect(config.server.ws).toBe(false)
  expect(config.server.hmr).not.toBe(false)
  expect(config.server.watch).toEqual({ usePolling: true, interval: 100 })
  expect(config.weapp.hmr.runtime).toBe('stateful-experimental')
})
