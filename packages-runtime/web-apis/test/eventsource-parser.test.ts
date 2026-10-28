import { describe, expect, it } from 'vitest'
import { EventStreamParser } from '../src/eventsource/parser'

describe('EventSource incremental parser', () => {
  it('preserves field and event semantics across every character boundary', () => {
    const input = '\uFEFF:heartbeat\r\nretry: 15\r\nid: first\r\n\r\nid: ignored\0value\r\nevent: delta\r\ndata: 中文\r\ndata: 😀\r\n\r\nid:\r\rdata:\r\rdata: unfinished'
    for (let split = 0; split <= input.length; split++) {
      const events: unknown[] = []
      const ids: string[] = []
      const delays: number[] = []
      const parser = new EventStreamParser({ onEvent: value => events.push(value), onId: value => ids.push(value), onRetry: value => delays.push(value) })
      parser.feed(input.slice(0, split))
      parser.feed(input.slice(split))
      expect(events).toEqual([
        { type: 'delta', data: '中文\n😀', lastEventId: 'first' },
        { type: 'message', data: '', lastEventId: '' },
      ])
      expect(ids).toEqual(['first', 'first', '', ''])
      expect(delays).toEqual([15])
    }
  })

  it('accepts one-character chunks and ignores invalid retry fields and unknown fields', () => {
    const events: unknown[] = []
    const delays: number[] = []
    const parser = new EventStreamParser({ onEvent: value => events.push(value), onId() {}, onRetry: value => delays.push(value) }, 'inherited')
    for (const character of 'retry: +2\nretry: 1.2\nretry:\nunknown: x\nevent: named\nevent:\ndata: one\ndata:  two\n\n') {
      parser.feed(character)
    }
    expect(events).toEqual([{ type: 'message', data: 'one\n two', lastEventId: 'inherited' }])
    expect(delays).toEqual([])
  })

  it('does not commit a partial ID or dispatch an event at EOF without a blank line', () => {
    const events: unknown[] = []
    const ids: string[] = []
    const parser = new EventStreamParser({ onEvent: value => events.push(value), onId: value => ids.push(value), onRetry() {} })
    parser.feed('id: partial\ndata: pending\n')
    expect(events).toEqual([])
    expect(ids).toEqual([])
  })
})
