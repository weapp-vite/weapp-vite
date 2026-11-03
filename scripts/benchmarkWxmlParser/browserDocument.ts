import type { BrowserContext, Page } from 'playwright'

export const BENCHMARK_ORIGIN = 'https://wxml-benchmark.invalid'
export const ISOLATION_HEADERS = {
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-embedder-policy': 'require-corp',
  'cache-control': 'no-store',
} as const

export async function installBenchmarkDocument(context: BrowserContext) {
  await context.route(`${BENCHMARK_ORIGIN}/**`, route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    headers: ISOLATION_HEADERS,
    body: '<!doctype html><meta charset="utf-8"><title>WXML parser benchmark</title>',
  }))
}

export async function loadBenchmarkDocument(page: Page, phase: 'warm' | 'cold') {
  const response = await page.goto(`${BENCHMARK_ORIGIN}/${phase}`)
  const headers = response ? await response.allHeaders() : {}
  const crossOriginIsolated = await page.evaluate(() => globalThis.crossOriginIsolated)
  if (!crossOriginIsolated || !Object.entries(ISOLATION_HEADERS).every(([name, value]) => headers[name] === value)) {
    throw new Error('Benchmark document did not receive cross-origin isolation headers or crossOriginIsolated is false.')
  }
  return { url: page.url(), responseHeaders: headers, crossOriginIsolated }
}
