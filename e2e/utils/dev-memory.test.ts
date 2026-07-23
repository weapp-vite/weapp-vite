import { describe, expect, it, vi } from 'vitest'
import { sampleHeapAfterGc, waitForHeapUsageToSettle } from './dev-memory'

class HangingWebSocket extends EventTarget {
  static instances: HangingWebSocket[] = []

  close = vi.fn()
  send = vi.fn()

  constructor() {
    super()
    HangingWebSocket.instances.push(this)
  }
}

class SilentCommandWebSocket extends EventTarget {
  static instances: SilentCommandWebSocket[] = []

  close = vi.fn()
  send = vi.fn()

  constructor() {
    super()
    SilentCommandWebSocket.instances.push(this)
    setTimeout(() => {
      this.dispatchEvent(new Event('open'))
    }, 0)
  }
}

const originalWebSocket = globalThis.WebSocket

describe('dev-memory inspector sampling', () => {
  it('waits for transient retained heap usage to settle', async () => {
    const samples = [
      { heapUsed: 460, rss: 600 },
      { heapUsed: 260, rss: 400 },
      { heapUsed: 262, rss: 402 },
      { heapUsed: 263, rss: 403 },
    ]
    const sampleUsage = vi.fn(async () => samples.shift()!)

    await expect(waitForHeapUsageToSettle(sampleUsage, {
      intervalMs: 0,
      maxAttempts: 4,
      toleranceBytes: 8,
    })).resolves.toEqual({ heapUsed: 263, rss: 403 })
    expect(sampleUsage).toHaveBeenCalledTimes(4)
  })

  it('returns the latest sample when heap usage never settles', async () => {
    const samples = [
      { heapUsed: 100, rss: 200 },
      { heapUsed: 120, rss: 220 },
      { heapUsed: 140, rss: 240 },
      { heapUsed: 160, rss: 260 },
    ]

    await expect(waitForHeapUsageToSettle(async () => samples.shift()!, {
      intervalMs: 0,
      maxAttempts: 4,
      toleranceBytes: 8,
    })).resolves.toEqual({ heapUsed: 160, rss: 260 })
  })

  it('times out and closes when inspector WebSocket never opens', async () => {
    globalThis.WebSocket = HangingWebSocket as unknown as typeof WebSocket

    try {
      await expect(sampleHeapAfterGc('ws://127.0.0.1:1/devtools/page/1', 10))
        .rejects
        .toThrow('Timed out opening inspector WebSocket after 10ms.')
      expect(HangingWebSocket.instances.at(-1)?.close).toHaveBeenCalledTimes(1)
    }
    finally {
      globalThis.WebSocket = originalWebSocket
    }
  })

  it('times out and closes when inspector commands do not respond', async () => {
    globalThis.WebSocket = SilentCommandWebSocket as unknown as typeof WebSocket

    try {
      await expect(sampleHeapAfterGc('ws://127.0.0.1:1/devtools/page/1', 10))
        .rejects
        .toThrow('Timed out waiting for inspector command HeapProfiler.collectGarbage after 10ms.')
      expect(SilentCommandWebSocket.instances.at(-1)?.send).toHaveBeenCalledWith(JSON.stringify({
        id: 1,
        method: 'HeapProfiler.collectGarbage',
      }))
      expect(SilentCommandWebSocket.instances.at(-1)?.close).toHaveBeenCalledTimes(1)
    }
    finally {
      globalThis.WebSocket = originalWebSocket
    }
  })
})
