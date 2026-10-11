import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MiniProgram from './MiniProgram'

interface PagePayload {
  pageId: number
  path: string
  query: Record<string, unknown>
}

function createNavigationHarness(provider: 'current' | 'stack', initialQuery: Record<string, unknown>) {
  let observedPage: PagePayload = { pageId: 7, path: '/pages/detail/index', query: initialQuery }
  let navigationSent = false
  const connection = Object.assign(new EventEmitter(), {
    send: vi.fn(async (method: string) => {
      if (method === 'App.callWxMethod') {
        navigationSent = true
        return {}
      }
      if (method === 'App.getCurrentPage') {
        if (navigationSent && provider === 'stack') {
          throw Object.assign(new Error('current page metadata unavailable'), {
            code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
            method,
          })
        }
        return observedPage
      }
      if (method === 'App.getPageStack') {
        return { pageStack: [observedPage] }
      }
      throw new Error(`Unexpected protocol call: ${method}`)
    }),
  })
  return {
    miniProgram: new MiniProgram(connection as any),
    connection,
    observe(page: PagePayload) {
      observedPage = page
    },
  }
}

describe('MiniProgram navigation query readiness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    { provider: 'current' as const, initialQuery: {} },
    { provider: 'current' as const, initialQuery: { source: 'old' } },
    { provider: 'stack' as const, initialQuery: {} },
    { provider: 'stack' as const, initialQuery: { source: 'old' } },
  ])('waits for requested query using $provider metadata from $initialQuery', async ({ provider, initialQuery }) => {
    const { miniProgram, connection, observe } = createNavigationHarness(provider, initialQuery)
    const settled = vi.fn()
    const pending = miniProgram.reLaunch('/pages/detail/index?source=new').then((page) => {
      settled()
      return page
    })

    await vi.advanceTimersByTimeAsync(500)
    expect(settled).not.toHaveBeenCalled()

    const query = { source: 'new', hostValue: 'preserved' }
    observe({ pageId: 8, path: '/pages/detail/index', query })
    await vi.advanceTimersByTimeAsync(500)
    const page = await pending

    expect(page.pageId).toBe(8)
    expect(page.query).toEqual(query)
    expect(connection.send.mock.calls.filter(([method]) => method === 'App.callWxMethod')).toHaveLength(1)
  })

  it('follows observed host navigation without requiring a fixed page identity or replaying the command', async () => {
    const { miniProgram, connection, observe } = createNavigationHarness('current', { source: 'old' })
    const settled = vi.fn()
    const pending = miniProgram.reLaunch('/pages/detail/index?source=new').then((page) => {
      settled()
      return page
    })

    await vi.advanceTimersByTimeAsync(0)
    observe({ pageId: 8, path: '/pages/detail/index', query: {} })
    await vi.advanceTimersByTimeAsync(500)
    observe({ pageId: 9, path: '/pages/detail/index', query: { source: 'old' } })
    await vi.advanceTimersByTimeAsync(500)
    expect(settled).not.toHaveBeenCalled()

    observe({ pageId: 9, path: '/pages/detail/index', query: { source: 'new' } })
    await vi.advanceTimersByTimeAsync(500)
    const page = await pending

    expect(page.pageId).toBe(9)
    expect(page.query).toEqual({ source: 'new' })
    expect(connection.send.mock.calls.filter(([method]) => method === 'App.callWxMethod')).toHaveLength(1)
  })

  it('accepts matching observed query without requiring a new page frame', async () => {
    const { miniProgram } = createNavigationHarness('current', { source: 'new' })
    const pending = miniProgram.reLaunch('/pages/detail/index?source=new')
    await vi.advanceTimersByTimeAsync(0)
    const page = await pending
    expect(page.pageId).toBe(7)
    expect(page.query).toEqual({ source: 'new' })
  })

  it.each(['current', 'stack'] as const)('rejects persistent mismatching %s metadata instead of filling in the requested query', async (provider) => {
    const initialQuery = { source: 'old' }
    const { miniProgram } = createNavigationHarness(provider, initialQuery)
    const outcome = miniProgram.reLaunch('/pages/detail/index?source=new').then(
      page => ({ page, error: undefined }),
      (error: unknown) => ({ page: undefined, error }),
    )
    await vi.advanceTimersByTimeAsync(16_000)
    const result = await outcome
    expect(result.page).toBeUndefined()
    expect(result.error).toBeInstanceOf(Error)
    expect((result.error as Error).message).toContain('Timed out waiting route pages/detail/index after reLaunch')
    expect(initialQuery).toEqual({ source: 'old' })
  })

  it.each([
    { source: '中文 空格' },
    { source: '%E4%B8%AD%E6%96%87%20%E7%A9%BA%E6%A0%BC' },
  ])('preserves observed encoded or decoded query values: $source', async (query) => {
    const { miniProgram } = createNavigationHarness('current', query)
    const pending = miniProgram.reLaunch('/pages/detail/index?source=%E4%B8%AD%E6%96%87%20%E7%A9%BA%E6%A0%BC')
    await vi.advanceTimersByTimeAsync(0)
    expect((await pending).query).toEqual(query)
  })

  it('requires an explicitly requested empty query key to exist', async () => {
    const { miniProgram, observe } = createNavigationHarness('current', {})
    const settled = vi.fn()
    const pending = miniProgram.reLaunch('/pages/detail/index?source=').then((page) => {
      settled()
      return page
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).not.toHaveBeenCalled()
    observe({ pageId: 8, path: '/pages/detail/index', query: { source: '' } })
    await vi.advanceTimersByTimeAsync(500)
    expect((await pending).query).toEqual({ source: '' })
  })
})
