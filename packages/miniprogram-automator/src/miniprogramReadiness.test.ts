import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import MiniProgram from './MiniProgram'

describe('MiniProgram bounded readiness probes', () => {
  it.each([
    'Cannot destructure property \'rawPath\' of \'t.getPageMetaByWebviewId(...)\' as it is null.',
    'timeout waiting for automator response',
  ])('preserves %s without issuing retry or fallback requests', async (message) => {
    const failure = new Error(message)
    const connection = Object.assign(new EventEmitter(), {
      send: vi.fn().mockRejectedValue(failure),
    })
    const miniProgram = new MiniProgram(connection as any)
    await expect(miniProgram.currentPage({
      appFunctionFallback: false,
      pageStackFallback: false,
      retries: 1,
      timeout: 300,
    })).rejects.toBe(failure)
    expect(connection.send.mock.calls).toEqual([
      ['App.getCurrentPage', {}, { timeout: 300 }],
    ])
  })
})
