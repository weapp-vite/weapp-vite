import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { chunkedRequestFiles, chunkedRequestMock } from './helpers/chunkedRequest'

describe('chunked request host contract', () => {
  afterEach(() => vi.useRealTimers())
  it.each(['normal', 'abort-before', 'abort', 'off', 'disconnect', 'empty'])('%s preserves stages, removal and exactly one terminal callback pair', async (mode) => {
    vi.useFakeTimers()
    const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(chunkedRequestFiles) })
    const mock = chunkedRequestMock()
    session.mockRequest({ ...mock, chunks: mode === 'empty' ? [] : mock.chunks, error: mode === 'disconnect' ? 'request:fail network error' : undefined })
    try {
      const page = session.reLaunch('/pages/index')
      page.start(mode)
      expect(page.data.status).toBe('waiting')
      if (mode === 'abort-before') {
        page.abort()
      }
      await vi.advanceTimersByTimeAsync(20)
      if (mode === 'normal') {
        expect(page.data.status).toBe('streaming')
        expect(page.data.events).toEqual(['headers', 'chunk'])
        expect(page.data.bytes).toEqual([0, 0xE4])
      }
      await vi.runAllTimersAsync()
      const failed = ['abort-before', 'abort', 'disconnect'].includes(mode)
      expect(page.data.events.slice(-2)).toEqual([failed ? 'fail' : 'success', 'complete'])
      expect(page.data.removed).toBe(0)
      expect(page.data.status).toBe('completed')
      expect(page.data.events.filter((event: string) => event === 'complete')).toHaveLength(1)
      if (!failed) {
        expect(page.data.result).toBe('')
      }
      if (mode === 'normal') {
        expect(page.data.bytes).toEqual([0, 0xE4, 0xB8, 0xAD, 255])
      }
      if (mode === 'off' || mode === 'abort') {
        expect(page.data.bytes).toEqual([0, 0xE4])
      }
      if (mode === 'abort-before' || mode === 'empty') {
        expect(page.data.bytes).toEqual([])
      }
      const snapshot = JSON.stringify(page.data)
      page.abort()
      await vi.runAllTimersAsync()
      expect(JSON.stringify(page.data)).toBe(snapshot)
    }
    finally {
      session.close()
    }
  })
})
