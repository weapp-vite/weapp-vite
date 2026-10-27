import type { DomCheckpoint, DomElement, DomPage, DomSession } from './types'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureDomCheckpoint } from './checkpoint'
import { createDomScopeTrace } from './scopeTrace'

const traceEnv = 'WEAPP_VITE_E2E_DOM_SCOPE_TRACE_CHECKPOINTS'
const checkpoint: DomCheckpoint = {
  id: 'home-ready',
  route: 'pages/home/index',
  action: '检查组件内的商品标题',
  nodes: [{ selector: '.title', scope: [{ has: '.goods-list-wrap' }, '#first-card'], text: 'ready' }],
}

function observeOutput() {
  const records: Array<Record<string, unknown>> = []
  vi.spyOn(process.stdout, 'write').mockImplementation((value) => {
    records.push(JSON.parse(String(value).replace(/^\[dom-scope-trace\] /, '')) as Record<string, unknown>)
    return true
  })
  return records
}

function createScopePage() {
  const calls: string[] = []
  const timeouts: number[] = []
  const title: DomElement = { text: async () => {
    calls.push('title:text')
    return 'ready'
  } }
  const card: DomElement = {
    text: async () => '',
    $$: async (selector, options) => {
      calls.push(`card:${selector}`)
      timeouts.push(options.timeout)
      return [title]
    },
  }
  const parent: DomElement = {
    text: async () => '',
    $$: async (selector, options) => {
      calls.push(`parent:${selector}`)
      timeouts.push(options.timeout)
      return selector === '.goods-list-wrap' ? [title] : [card]
    },
  }
  const unrelated: DomElement = {
    text: async () => '',
    $$: async (selector, options) => {
      calls.push(`unrelated:${selector}`)
      timeouts.push(options.timeout)
      return []
    },
  }
  const page: DomPage = {
    pageId: 1,
    path: 'pages/home/index',
    $$: async (selector, options) => {
      calls.push(`page:${selector}`)
      timeouts.push(options.timeout)
      return [parent, unrelated]
    },
  }
  const session: DomSession = { currentPage: async () => {
    calls.push('currentPage')
    return page
  } }
  return { calls, timeouts, page, parent, session }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('DOM scope query diagnostics', () => {
  it.each([undefined, '', 'another-checkpoint', 'home-ready-more', '*'])('stays disabled without an exact checkpoint match: %j', (value) => {
    vi.stubEnv(traceEnv, value)
    const output = observeOutput()
    expect(createDomScopeTrace('home-ready', 'headless', Date.now() + 1_000)).toBeUndefined()
    expect(output).toEqual([])
  })

  it('records existing counts, monotonic duration and remaining original budget', () => {
    vi.stubEnv(traceEnv, 'initial, home-ready')
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(110).mockReturnValueOnce(111).mockReturnValueOnce(140).mockReturnValueOnce(141)
    const output = observeOutput()
    const trace = createDomScopeTrace('home-ready', 'headless', 2_000)
    const span = trace!.start('scope-candidate', { attempt: 2, nodeIndex: 0, scopeIndex: 0, candidateIndex: 3, candidateCount: 15 })
    span.end({ count: 1 })
    expect(output).toEqual([
      expect.objectContaining({ checkpoint: 'home-ready', provider: 'headless', stage: 'scope-candidate', event: 'begin', attempt: 2, candidateIndex: 3, candidateCount: 15, elapsedMs: 11, remainingMs: 1_000 }),
      expect.objectContaining({ stage: 'scope-candidate', event: 'end', count: 1, durationMs: 30, elapsedMs: 41, remainingMs: 1_000 }),
    ])
    expect(output[0]?.traceId).toEqual(output[1]?.traceId)
  })

  it('preserves query order, query count, timeout and evidence when enabled', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const output = observeOutput()
    vi.stubEnv(traceEnv, '')
    const untraced = createScopePage()
    const original = await captureDomCheckpoint(untraced.session, untraced.page, checkpoint, 'headless', 1_000)
    expect(output).toEqual([])
    vi.stubEnv(traceEnv, 'home-ready')
    const traced = createScopePage()
    const evidence = await captureDomCheckpoint(traced.session, traced.page, checkpoint, 'headless', 1_000)
    expect(traced.calls).toEqual(untraced.calls)
    expect(traced.calls).toEqual([
      'currentPage',
      'page:component',
      'parent:.goods-list-wrap',
      'unrelated:.goods-list-wrap',
      'parent:#first-card',
      'card:.title',
      'title:text',
      'currentPage',
    ])
    expect(traced.timeouts).toEqual(untraced.timeouts)
    expect(traced.timeouts).toEqual([1_000, 1_000, 1_000, 1_000, 1_000])
    expect(evidence.nodes).toEqual(original.nodes)
    expect(output.filter(record => record.stage === 'scope-candidate' && record.event === 'end')).toEqual([
      expect.objectContaining({ attempt: 1, nodeIndex: 0, scopeIndex: 0, candidateIndex: 0, candidateCount: 2, count: 1 }),
      expect.objectContaining({ attempt: 1, nodeIndex: 0, scopeIndex: 0, candidateIndex: 1, candidateCount: 2, count: 0 }),
    ])
    expect(output.at(-1)).toMatchObject({ stage: 'attempt', event: 'end', status: 'passed' })
  })

  it('retains the original error and exhausted budget without extra queries', async () => {
    vi.stubEnv(traceEnv, 'home-ready')
    const output = observeOutput()
    const { page, parent, session, calls } = createScopePage()
    const error = new Error('component query rejected')
    parent.$$ = async () => {
      calls.push('parent:rejected')
      throw error
    }
    await expect(captureDomCheckpoint(session, page, checkpoint, 'headless', 0)).rejects.toMatchObject({ cause: error })
    expect(calls).toEqual(['currentPage', 'page:component', 'parent:rejected'])
    expect(output.at(-1)).toMatchObject({ stage: 'attempt', event: 'end', status: 'failed', error: error.message, remainingMs: 0 })
    expect(output.filter(record => record.stage === 'scope-candidate')).toHaveLength(1)
  })

  it('chooses the latest in-budget failure before diagnostic output advances time', async () => {
    vi.stubEnv(traceEnv, 'home-ready')
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => {
      const record = JSON.parse(String(value).replace(/^\[dom-scope-trace\] /, '')) as Record<string, unknown>
      if (record.stage === 'attempt' && record.status === 'failed' && record.attempt === 2) {
        now = 20
      }
      return true
    })
    const { page, session } = createScopePage()
    const earlier = new Error('earlier query failure')
    const latest = new Error('latest in-budget query failure')
    page.$$ = vi.fn()
      .mockImplementationOnce(async () => {
        now = 5
        throw earlier
      })
      .mockImplementationOnce(async () => {
        now = 8
        throw latest
      })
    await expect(captureDomCheckpoint(session, page, checkpoint, 'headless', 10)).rejects.toMatchObject({ cause: latest })
    expect(page.$$).toHaveBeenCalledTimes(2)
    expect(now).toBe(20)
  })

  it('does not replace the original query result when diagnostic output fails', async () => {
    vi.stubEnv(traceEnv, 'home-ready')
    vi.spyOn(process.stdout, 'write').mockImplementation(() => {
      throw new Error('diagnostic output rejected')
    })
    const { page, session } = createScopePage()
    await expect(captureDomCheckpoint(session, page, checkpoint, 'headless', 0)).resolves.toMatchObject({ id: 'home-ready' })
  })
})
