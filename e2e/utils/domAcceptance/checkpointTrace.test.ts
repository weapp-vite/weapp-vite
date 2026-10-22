import type { DomCheckpoint, DomElement, DomPage, DomSession } from './types'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureDomCheckpoint } from './checkpoint'

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn() }))

const traceOutput = vi.fn()

interface TraceReport {
  timeoutMs: number
  elapsedMs: number
  totalAttempts: number
  droppedAttempts: number
  attempts: Array<{
    attempt: number
    durationMs: number
    queries: Array<{ target: string, selector: string, durationMs: number, count?: number, failed?: boolean }>
    droppedQueries: number
    scopes: Array<{ scope: string | { has: string }, candidates: number, matches: number }>
    error: { message: string, atMs: number, remainingMs: number, usedAsLastError: boolean }
  }>
}

const checkpoint: DomCheckpoint = {
  id: 'initial',
  route: '/pages/index/index',
  action: 'launch',
  nodes: [{ selector: '#message', text: 'ready' }],
}

function createPage() {
  const page: DomPage = {
    pageId: 1,
    path: 'pages/index/index',
    $$: vi.fn(async () => [{ text: async () => 'ready' }]),
  }
  const session: DomSession = { currentPage: vi.fn(async () => page) }
  return { page, session }
}

function readTrace() {
  expect(traceOutput).toHaveBeenCalledTimes(1)
  const [label, report] = traceOutput.mock.calls[0]!
  expect(label).toBe('[dom-checkpoint-failure-trace]')
  return JSON.parse(report) as TraceReport
}

describe('DOM checkpoint failure tracing', () => {
  let now: number

  beforeEach(() => {
    now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    vi.spyOn(console, 'error').mockImplementation(traceOutput)
    vi.mocked(delay).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('separates page and scope query time without making additional queries', async () => {
    const { page, session } = createPage()
    const parentQuery = vi.fn(async (selector: string) => {
      now += selector === '.goods-list-wrap' ? 7 : 3
      return selector === '.goods-list-wrap' ? [{ text: async () => '' }] : []
    })
    page.$$ = vi.fn(async () => {
      now += 6_000
      return [{ text: async () => '', $$: parentQuery }]
    })
    await expect(captureDomCheckpoint(session, page, {
      ...checkpoint,
      nodes: [{ selector: '.title', scope: [{ has: '.goods-list-wrap' }, '#card'], text: 'ready' }],
    }, 'headless', 0)).rejects.toThrow('DOM component scope "#card": expected 1, received 0')

    expect(page.$$).toHaveBeenCalledTimes(1)
    expect(parentQuery.mock.calls.map(([selector]) => selector)).toEqual(['.goods-list-wrap', '#card'])
    expect(session.currentPage).toHaveBeenCalledTimes(1)
    const trace = readTrace()
    expect(trace.attempts[0]).toMatchObject({
      durationMs: 6_010,
      queries: [
        { target: 'session', selector: 'currentPage', durationMs: 0 },
        { target: 'page', selector: 'component', durationMs: 6_000, count: 1 },
        { target: 'scope-descendant', selector: '.goods-list-wrap', durationMs: 7, count: 1 },
        { target: 'scope', selector: '#card', durationMs: 3, count: 0 },
      ],
      scopes: [
        { scope: { has: '.goods-list-wrap' }, candidates: 1, matches: 1 },
        { scope: '#card', candidates: 0, matches: 0 },
      ],
    })
  })

  it('preserves the earlier reported error while recording a later over-budget query failure', async () => {
    const { page, session } = createPage()
    page.$$ = vi.fn()
      .mockImplementationOnce(async () => {
        now = 5
        throw new Error('early failure')
      })
      .mockImplementationOnce(async () => {
        now = 20
        throw new Error('late failure')
      })
    await expect(captureDomCheckpoint(session, page, checkpoint, 'headless', 10)).rejects.toThrow('early failure')
    const trace = readTrace()
    expect(trace.totalAttempts).toBe(2)
    expect(trace.attempts.map(attempt => attempt.error)).toEqual([
      { message: 'early failure', atMs: 5, remainingMs: 5, usedAsLastError: true },
      { message: 'late failure', atMs: 20, remainingMs: -10, usedAsLastError: false },
    ])
    expect(trace.attempts[1]!.queries.at(-1)).toMatchObject({
      target: 'page',
      selector: '#message',
      durationMs: 15,
      failed: true,
    })
    expect(page.$$).toHaveBeenCalledTimes(2)
    expect(delay).toHaveBeenCalledTimes(1)
  })

  it('retains only the latest sixteen failed attempts', async () => {
    const { page, session } = createPage()
    page.$$ = vi.fn(async () => {
      now++
      return []
    })
    await expect(captureDomCheckpoint(session, page, checkpoint, 'headless', 20)).rejects.toThrow('#message count')
    const trace = readTrace()
    expect(trace).toMatchObject({ totalAttempts: 20, droppedAttempts: 4, elapsedMs: 20, timeoutMs: 20 })
    expect(trace.attempts).toHaveLength(16)
    expect(trace.attempts[0]!.attempt).toBe(5)
    expect(trace.attempts.at(-1)!.attempt).toBe(20)
    expect(page.$$).toHaveBeenCalledTimes(20)
  })

  it('bounds large candidate traces while keeping page queries and the latest descendant queries', async () => {
    const { page, session } = createPage()
    const query = vi.fn(async () => [] as DomElement[])
    page.$$ = vi.fn(async () => Array.from({ length: 160 }, () => ({ text: async () => '', $$: query })))
    await expect(captureDomCheckpoint(session, page, {
      ...checkpoint,
      nodes: [{ selector: '#message', scope: [{ has: '.parent' }], text: 'ready' }],
    }, 'headless', 0)).rejects.toThrow('expected 1, received 0')
    const attempt = readTrace().attempts[0]!
    expect(attempt.queries).toHaveLength(128)
    expect(attempt.droppedQueries).toBe(34)
    expect(attempt.queries[1]).toMatchObject({ target: 'page', count: 160 })
    expect(attempt.queries.at(-1)).toMatchObject({ target: 'scope-descendant', count: 0 })
    expect(attempt.scopes).toEqual([{ scope: { has: '.parent' }, candidates: 160, matches: 0 }])
    expect(query).toHaveBeenCalledTimes(160)
  })

  it('stays silent when a later original query succeeds', async () => {
    const { page, session } = createPage()
    page.$$ = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ text: async () => 'ready' }])
    await expect(captureDomCheckpoint(session, page, checkpoint, 'headless', 100)).resolves.toMatchObject({ id: 'initial' })
    expect(traceOutput).not.toHaveBeenCalled()
    expect(page.$$).toHaveBeenCalledTimes(2)
    expect(session.currentPage).toHaveBeenCalledTimes(3)
    expect(delay).toHaveBeenCalledTimes(1)
  })

  it('preserves the DOM failure when diagnostic output throws', async () => {
    const { page, session } = createPage()
    page.$$ = vi.fn(async () => [])
    traceOutput.mockImplementationOnce(() => {
      throw new Error('diagnostic sink unavailable')
    })
    await expect(captureDomCheckpoint(session, page, checkpoint, 'headless', 0)).rejects.toThrow('#message count: expected 1, received 0')
    expect(traceOutput).toHaveBeenCalledTimes(1)
  })
})
