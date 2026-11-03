import type { BrowserContext, Page, Route } from 'playwright'
import { describe, expect, it, vi } from 'vitest'
import { BENCHMARK_ORIGIN, installBenchmarkDocument, ISOLATION_HEADERS, loadBenchmarkDocument } from './browserDocument'

describe('isolated benchmark documents', () => {
  it('serves the controlled secure origin with COOP and COEP headers', async () => {
    const fulfill = vi.fn(async () => {})
    const route = vi.fn(async (_pattern: string, handler: (route: Route) => Promise<void>) => handler({ fulfill } as unknown as Route))
    await installBenchmarkDocument({ route } as unknown as BrowserContext)
    expect(route.mock.calls[0]![0]).toBe(`${BENCHMARK_ORIGIN}/**`)
    expect(fulfill.mock.calls[0]).toMatchObject([{ status: 200, headers: { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' } }])
  })

  it.each(['warm', 'cold'] as const)('checks actual isolation and response headers for %s documents', async (phase) => {
    const goto = vi.fn(async () => ({ allHeaders: async () => ISOLATION_HEADERS }))
    const evaluate = vi.fn(async () => true)
    const page = { goto, evaluate, url: () => `${BENCHMARK_ORIGIN}/${phase}` } as unknown as Page
    expect(await loadBenchmarkDocument(page, phase)).toMatchObject({ crossOriginIsolated: true, responseHeaders: ISOLATION_HEADERS })
    expect(goto.mock.calls[0]).toEqual([`${BENCHMARK_ORIGIN}/${phase}`])
    evaluate.mockResolvedValue(false)
    await expect(loadBenchmarkDocument(page, phase)).rejects.toThrow('crossOriginIsolated')
  })
})
