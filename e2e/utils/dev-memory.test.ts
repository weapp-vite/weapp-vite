import { describe, expect, it, vi } from 'vitest'
import { sampleHeapAfterGc } from './dev-memory'

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
