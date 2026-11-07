import { describe, expect, it, vi } from 'vitest'
import { EventStreamParser } from '../src/eventsource/parser'

describe('EventSource field boundaries', () => {
  it('dispatches colonless data as an empty message while empty non-data blocks only commit IDs', () => {
    const onEvent = vi.fn()
    const onId = vi.fn()
    const parser = new EventStreamParser({ onEvent, onId, onRetry: vi.fn() }, 'initial')
    parser.feed('id\nevent: named\n\ndata\n\n')
    expect(onId.mock.calls).toEqual([[''], ['']])
    expect(onEvent.mock.calls).toEqual([[{ type: 'message', data: '', lastEventId: '' }]])
  })

  it('preserves a leading space beyond the optional first space and ignores empty field names', () => {
    const onEvent = vi.fn()
    const parser = new EventStreamParser({ onEvent, onId: vi.fn(), onRetry: vi.fn() })
    parser.feed(': keepalive\n:ignored\nevent:  named\ndata:  value\n\n')
    expect(onEvent).toHaveBeenCalledExactlyOnceWith({ type: ' named', data: ' value', lastEventId: '' })
  })

  it('handles a bare CR followed by ordinary data without dropping the next first character', () => {
    const onEvent = vi.fn()
    const parser = new EventStreamParser({ onEvent, onId: vi.fn(), onRetry: vi.fn() })
    parser.feed('data: one\r')
    parser.feed('data: two\r')
    parser.feed('\r')
    expect(onEvent).toHaveBeenCalledExactlyOnceWith({ type: 'message', data: 'one\ntwo', lastEventId: '' })
  })

  it('accepts finite retry values, clamps large values and ignores numeric overflow', () => {
    const onRetry = vi.fn()
    const parser = new EventStreamParser({ onEvent: vi.fn(), onId: vi.fn(), onRetry })
    parser.feed(`retry: 0\nretry: 2147483648\nretry: ${'9'.repeat(400)}\nretry\nretry: -1\n`)
    expect(onRetry.mock.calls).toEqual([[0], [2147483647]])
  })

  it('does not treat a BOM after the first nonempty chunk as a field prefix', () => {
    const onEvent = vi.fn()
    const parser = new EventStreamParser({ onEvent, onId: vi.fn(), onRetry: vi.fn() })
    parser.feed('')
    parser.feed('\uFEFFdata: first\n\n')
    parser.feed('\uFEFFdata: ignored\ndata: second\n\n')
    expect(onEvent.mock.calls).toEqual([
      [{ type: 'message', data: 'first', lastEventId: '' }],
      [{ type: 'message', data: 'second', lastEventId: '' }],
    ])
  })
})
