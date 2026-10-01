import type { Page, Request, Response } from 'playwright'

/** 仅观察请求元数据，不读取响应正文、认证头或修改导航行为。 */
export function observeNavigation(page: Page) {
  const started = performance.now()
  const pending = new Map<Request, { url: string, resourceType: string, startedMs: number }>()
  const events: Record<string, unknown>[] = []
  const elapsed = () => Math.round(performance.now() - started)
  const pathOf = (url: string) => {
    try {
      const parsed = new URL(url)
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
    }
    catch {
      return '<unparsed-url>'
    }
  }
  const record = (event: Record<string, unknown>) => {
    events.push({ atMs: elapsed(), ...event })
    if (events.length > 500) {
      events.shift()
    }
  }
  const request = (value: Request) => {
    const input = { url: pathOf(value.url()), resourceType: value.resourceType(), startedMs: elapsed() }
    pending.set(value, input)
    record({ event: 'request', ...input })
  }
  const response = (value: Response) => record({ event: 'response', url: pathOf(value.url()), status: value.status() })
  const finished = (value: Request) => {
    record({ event: 'finished', url: pathOf(value.url()), timing: value.timing() })
    pending.delete(value)
  }
  const failed = (value: Request) => {
    record({ event: 'failed', url: pathOf(value.url()), error: value.failure()?.errorText, timing: value.timing() })
    pending.delete(value)
  }
  const domReady = () => record({ event: 'domcontentloaded' })
  const loaded = () => record({ event: 'load' })
  const crashed = () => record({ event: 'crash' })
  page.on('request', request)
  page.on('response', response)
  page.on('requestfinished', finished)
  page.on('requestfailed', failed)
  page.on('domcontentloaded', domReady)
  page.on('load', loaded)
  page.on('crash', crashed)
  return {
    snapshot: () => ({ elapsedMs: elapsed(), events: [...events], pending: [...pending.values()], pageUrl: pathOf(page.url()) }),
    stop() {
      page.off('request', request)
      page.off('response', response)
      page.off('requestfinished', finished)
      page.off('requestfailed', failed)
      page.off('domcontentloaded', domReady)
      page.off('load', loaded)
      page.off('crash', crashed)
    },
  }
}
