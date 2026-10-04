import { describe, expect, it, vi } from 'vitest'
import { readReadyBenchPage } from './runtimeBench/navigation'

function page(route = 'pages/detail/index', state: unknown = { readyMarker: 'vue-detail-ready', metrics: { loadToReadyMs: 12 } }) {
  return { path: route, waitFor: vi.fn(async () => {}), callMethod: vi.fn(async () => state) }
}

describe('runtime benchmark navigation observations', () => {
  it('waits past the prior page even when both pages contain the common DOM marker', async () => {
    const prior = page('pages/index/index', { readyMarker: 'vue-index-ready', metrics: { loadToReadyMs: 5 } })
    const target = page()
    const currentPage = vi.fn().mockResolvedValueOnce(prior).mockResolvedValue(target)
    const result = readReadyBenchPage({ currentPage }, '/pages/detail/index', 'runtime-bench-vue')
    await expect(result).resolves.toEqual({ page: target, readyMs: 12 })
    expect(prior.callMethod).not.toHaveBeenCalled()
    expect(target.waitFor.mock.calls).toEqual([['#bench-ready-marker'], [120]])
  })

  it('rejects a route that remains on the previous page', async () => {
    const prior = page('pages/index/index')
    const assertion = expect(readReadyBenchPage({ currentPage: async () => prior }, '/pages/detail/index', 'runtime-bench-vue', { routeTimeoutMs: 100 })).rejects.toThrow('Benchmark route mismatch')
    await assertion
    expect(prior.callMethod).not.toHaveBeenCalled()
  })

  it.each([
    {},
    { readyMarker: 'vue-index-ready', metrics: { loadToReadyMs: 12 } },
  ])('rejects missing or mismatched page state instead of publishing a sample', async (state) => {
    await expect(readReadyBenchPage({ currentPage: async () => page('pages/detail/index', state) }, '/pages/detail/index', 'runtime-bench-vue')).rejects.toThrow('Benchmark ready marker mismatch')
  })

  it.each([undefined, null, '12', Number.NaN, Number.POSITIVE_INFINITY, -1])('requires a finite nonnegative ready metric: %s', async (loadToReadyMs) => {
    const target = page('pages/detail/index', { readyMarker: 'vue-detail-ready', metrics: { loadToReadyMs } })
    await expect(readReadyBenchPage({ currentPage: async () => target }, '/pages/detail/index', 'runtime-bench-vue')).rejects.toThrow('Missing valid loadToReadyMs')
  })

  it.each(['native', 'react', 'solid', 'vue'].flatMap(framework => ['index', 'detail'].map(route => ({ framework, route }))))('accepts observed zero duration for $framework/$route with its own marker', async ({ framework, route }) => {
    const target = page(`pages/${route}/index`, { readyMarker: `${framework}-${route}-ready`, metrics: { loadToReadyMs: 0 } })
    await expect(readReadyBenchPage({ currentPage: async () => target }, `/pages/${route}/index`, `runtime-bench-${framework}`)).resolves.toEqual({ page: target, readyMs: 0 })
  })
})
