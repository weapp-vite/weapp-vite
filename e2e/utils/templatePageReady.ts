import { setTimeout as delay } from 'node:timers/promises'

interface TemplateReadyPage {
  path: string
  waitFor: (ms: number) => Promise<unknown>
  waitForRendered: (options: { text: string, timeout: number }) => Promise<string>
  $: (selector: string) => Promise<{ outerWxml: () => Promise<string> } | null>
  data: (field: undefined, options: { routeOnly: true, timeout: number }) => Promise<unknown>
}

interface TemplateReadySession<Page extends TemplateReadyPage> {
  currentPage: () => Promise<Page | null | undefined>
  reLaunch: (route: string) => Promise<Page>
}

function normalizeRoutePath(routePath: string) {
  return routePath.split('?', 1)[0].split('#', 1)[0].replace(/^\/+/, '').replace(/\/+$/g, '')
}

function valueContainsText(value: unknown, text: string): boolean {
  if (typeof value === 'string') {
    return value.includes(text)
  }
  if (Array.isArray(value)) {
    return value.some(item => valueContainsText(item, text))
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(item => valueContainsText(item, text))
  }
  return false
}

function dataMatchesExpected(data: unknown, expected: Record<string, unknown> | undefined) {
  if (!expected || !data || typeof data !== 'object') {
    return false
  }
  const record = data as Record<string, unknown>
  return Object.entries(expected).every(([key, value]) => record[key] === value)
}

/** 就绪探针只使用调用方持有的连接；连接失败交由 case 统一重试、重建日志收集和清理。 */
export async function waitForTemplatePageReady<Page extends TemplateReadyPage>(
  miniProgram: TemplateReadySession<Page>,
  route: string,
  text: string,
  expectedData?: Record<string, unknown>,
  timeoutMs = 90_000,
): Promise<Page> {
  if (!route) {
    throw new Error(`Missing route while waiting for rendered text "${text}"`)
  }
  const normalizedRoute = normalizeRoutePath(route)
  const start = Date.now()
  let latestWxml = ''
  let latestData = ''
  let latestRoute = ''

  while (Date.now() - start <= timeoutMs) {
    const currentPage = await miniProgram.currentPage()
    latestRoute = String(currentPage?.path ?? '')
    const page = currentPage && normalizeRoutePath(currentPage.path) === normalizedRoute
      ? currentPage
      : await miniProgram.reLaunch(route)
    latestRoute = page.path
    await page.waitFor(500)
    try {
      latestWxml = await page.waitForRendered({
        text,
        timeout: Math.min(5_000, Math.max(1, timeoutMs - (Date.now() - start))),
      })
      return page
    }
    catch {
      // 继续读取 WXML，保留更具体的失败上下文。
    }
    const root = await page.$('page')
    latestWxml = root ? await root.outerWxml() : ''
    if (latestWxml.includes(text)) {
      return page
    }
    try {
      const data = await page.data(undefined, { routeOnly: true, timeout: 3_000 })
      latestData = JSON.stringify(data).slice(0, 1000)
      if (valueContainsText(data, text) || dataMatchesExpected(data, expectedData)) {
        return page
      }
    }
    catch {
      // Page 域 DOM 不稳定时，data fallback 也可能短暂不可读，继续轮询。
    }
    await delay(1_000)
  }

  throw new Error(`Timed out waiting for rendered text "${text}".\nLatest route: ${latestRoute || '<unknown>'}\nLatest data:\n${latestData || '<empty>'}\nLatest WXML:\n${latestWxml.slice(0, 1000)}`)
}
