import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

interface BenchPage {
  path: string
  waitFor: (condition: string | number) => Promise<void>
  callMethod: (method: string) => Promise<unknown>
}

interface BenchNavigationSession {
  currentPage: (options: { appFunctionFallback: boolean, pageStackFallback: boolean, retries: number, timeout: number }) => Promise<BenchPage>
}

function normalizeRoute(route: string) {
  return route.replace(/^\/+/, '').split('?')[0]
}

/** 路由与页面专属 marker 共同确认目标页；缺失 ready 指标必须终止采样。 */
export async function readReadyBenchPage(
  miniProgram: BenchNavigationSession,
  route: string,
  project: string,
  options: { settleMs?: number, routeTimeoutMs?: number } = {},
) {
  const framework = project.replace(/^runtime-bench-/, '')
  assert(['native', 'vue', 'react', 'solid'].includes(framework), `Unknown benchmark project: ${project}`)
  const normalizedRoute = normalizeRoute(route)
  const pageName = normalizedRoute?.split('/')[1]
  assert(pageName === 'index' || pageName === 'detail', `Unexpected benchmark route: ${route}`)
  const expectedMarker = `${framework}-${pageName}-ready`
  const deadline = Date.now() + (options.routeTimeoutMs ?? 15_000)
  let page: BenchPage | undefined
  while (Date.now() < deadline) {
    page = await miniProgram.currentPage({
      appFunctionFallback: false,
      pageStackFallback: false,
      retries: 1,
      timeout: Math.min(2_500, Math.max(1, deadline - Date.now())),
    })
    if (normalizeRoute(page.path) === normalizedRoute) {
      break
    }
    await delay(Math.min(50, Math.max(1, deadline - Date.now())))
  }
  assert(page && normalizeRoute(page.path) === normalizedRoute, `Benchmark route mismatch: expected ${normalizedRoute}, received ${page?.path ?? '<none>'}`)
  await page.waitFor('#bench-ready-marker')
  await page.waitFor(options.settleMs ?? 120)
  const state = await page.callMethod('readBenchState') as { readyMarker?: unknown, metrics?: { loadToReadyMs?: unknown } } | undefined
  assert.equal(state?.readyMarker, expectedMarker, `Benchmark ready marker mismatch for ${normalizedRoute}`)
  const readyMs = state?.metrics?.loadToReadyMs
  assert(typeof readyMs === 'number' && Number.isFinite(readyMs) && readyMs >= 0, `Missing valid loadToReadyMs for ${normalizedRoute}`)
  return { page, readyMs }
}
