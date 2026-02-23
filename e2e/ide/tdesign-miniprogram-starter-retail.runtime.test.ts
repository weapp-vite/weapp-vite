import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/tdesign-miniprogram-starter-retail')
const APP_JSON_PATH = path.resolve(APP_ROOT, 'app.json')
const PROJECT_CONFIG_PATH = path.resolve(APP_ROOT, 'project.config.json')
const DIST_ROOT = path.resolve(APP_ROOT, 'dist')

const ROUTE_QUERY_OVERRIDES = new Map<string, string>([
  ['pages/goods/details/index', 'spuId=135691625'],
  ['pages/order/order-confirm/index', 'type=cart'],
  ['pages/order/pay-result/index', 'paymentStatus=success&orderNo=132381532610540875'],
  ['pages/order/order-detail/index', 'orderNo=132381532610540875'],
  ['pages/order/apply-service/index', 'orderNo=132222623132329291&skuId=135691625&spuId=135691625'],
  ['pages/order/fill-tracking-no/index', 'rightsNo=123123423'],
  ['pages/order/delivery-detail/index', `data=${encodeURIComponent(JSON.stringify({
    nodes: [],
    company: '顺丰速运',
    logisticsNo: 'SF123456',
    phoneNumber: '95338',
  }))}`],
  ['pages/order/invoice/index', 'orderNo=132381532610540875'],
])

const ORDER_CONFIRM_GOODS_REQUEST_LIST = JSON.stringify([
  {
    quantity: 1,
    storeId: 1000,
    uid: 'u1000',
    saasId: 's1000',
    spuId: 'spu1000',
    goodsName: '测试商品',
    skuId: 'sku1000',
    storeName: '测试门店',
    roomId: 'r1000',
  },
])

function normalizeSegment(value: string) {
  return value.replace(/^\/+/, '').replace(/\/+$/, '')
}

function pushUnique(list: string[], seen: Set<string>, value: string) {
  if (!value || seen.has(value)) {
    return
  }
  seen.add(value)
  list.push(value)
}

function resolvePages(config: Record<string, any>) {
  const pages: string[] = []
  const seen = new Set<string>()

  if (Array.isArray(config.pages)) {
    for (const page of config.pages) {
      if (typeof page !== 'string') {
        continue
      }
      pushUnique(pages, seen, normalizeSegment(page))
    }
  }

  const subPackages = [
    ...(Array.isArray(config.subPackages) ? config.subPackages : []),
    ...(Array.isArray(config.subpackages) ? config.subpackages : []),
  ]

  for (const subPackage of subPackages) {
    if (!subPackage || typeof subPackage !== 'object') {
      continue
    }

    const root = typeof subPackage.root === 'string' ? normalizeSegment(subPackage.root) : ''
    const subPages = Array.isArray(subPackage.pages) ? subPackage.pages : []
    for (const page of subPages) {
      if (typeof page !== 'string') {
        continue
      }
      const normalizedPage = normalizeSegment(page)
      if (!normalizedPage) {
        continue
      }
      const combined = root ? `${root}/${normalizedPage}` : normalizedPage
      if (root && normalizedPage.startsWith(`${root}/`)) {
        pushUnique(pages, seen, normalizedPage)
      }
      else {
        pushUnique(pages, seen, combined)
      }
    }
  }

  return pages
}

function resolveLaunchQueryMap(config: Record<string, any>) {
  const map = new Map<string, string>()
  const list = config?.condition?.miniprogram?.list
  if (!Array.isArray(list)) {
    return map
  }

  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const pathName = typeof item.pathName === 'string' ? normalizeSegment(item.pathName) : ''
    const query = typeof item.query === 'string' ? item.query.trim() : ''
    if (!pathName || !query || map.has(pathName)) {
      continue
    }
    map.set(pathName, query)
  }

  return map
}

async function prepareRouteContext(miniProgram: any, pagePath: string) {
  if (pagePath === 'pages/order/order-confirm/index') {
    await miniProgram.callWxMethod('setStorageSync', 'order.goodsRequestList', ORDER_CONFIRM_GOODS_REQUEST_LIST)
  }
}

function buildRoute(pagePath: string, query?: string) {
  const normalizedPage = normalizeSegment(pagePath)
  const normalizedQuery = query?.trim()
  if (!normalizedQuery) {
    return `/${normalizedPage}`
  }
  return `/${normalizedPage}?${normalizedQuery}`
}

function normalizeConsoleText(entry: any) {
  if (typeof entry?.text === 'string' && entry.text.trim()) {
    return entry.text.trim()
  }
  if (Array.isArray(entry?.args) && entry.args.length > 0) {
    const text = entry.args
      .map((item: any) => {
        if (typeof item === 'string') {
          return item
        }
        try {
          return JSON.stringify(item)
        }
        catch {
          return String(item)
        }
      })
      .join(' ')
      .trim()
    if (text) {
      return text
    }
  }
  try {
    return JSON.stringify(entry)
  }
  catch {
    return String(entry)
  }
}

function isErrorConsoleEntry(entry: any) {
  const level = String(entry?.level ?? '').toLowerCase()
  if (level === 'error' || level === 'fatal') {
    return true
  }
  const text = normalizeConsoleText(entry)
  return /\b(?:TypeError|ReferenceError|SyntaxError|Error)\b/.test(text)
}

function formatRuntimeEntry(kind: 'console' | 'exception', entry: any) {
  const text = normalizeConsoleText(entry)
  if (kind === 'console') {
    const level = String(entry?.level ?? 'unknown').toLowerCase()
    return `[console:${level}] ${text}`
  }
  return `[exception] ${text}`
}

async function waitForPageRoot(page: any, timeoutMs = 10_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const element = await page.$('page')
    if (element) {
      return element
    }
    await page.waitFor(200)
  }
  return null
}

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:tdesign-retail-runtime',
  })
}

describe.sequential('e2e app: tdesign-miniprogram-starter-retail', () => {
  it('loads every page from app config without runtime errors', async () => {
    const appConfig = await fs.readJson(APP_JSON_PATH)
    const projectConfig = await fs.readJson(PROJECT_CONFIG_PATH)
    const pagePaths = resolvePages(appConfig)
    const launchQueryMap = resolveLaunchQueryMap(projectConfig)
    for (const [pagePath, query] of ROUTE_QUERY_OVERRIDES) {
      launchQueryMap.set(pagePath, query)
    }

    if (pagePaths.length === 0) {
      throw new Error('No pages found in app.json')
    }

    await runBuild()

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    const runtimeEvents: string[] = []
    const onConsole = (entry: any) => {
      if (isErrorConsoleEntry(entry)) {
        runtimeEvents.push(formatRuntimeEntry('console', entry))
      }
    }
    const onException = (entry: any) => {
      runtimeEvents.push(formatRuntimeEntry('exception', entry))
    }

    miniProgram.on('console', onConsole)
    miniProgram.on('exception', onException)

    try {
      for (const pagePath of pagePaths) {
        await prepareRouteContext(miniProgram, pagePath)
        const route = buildRoute(pagePath, launchQueryMap.get(pagePath))
        const eventCountBeforeRoute = runtimeEvents.length

        const page = await miniProgram.reLaunch(route)
        if (!page) {
          throw new Error(`Failed to launch page: ${route}`)
        }

        const pageRoot = await waitForPageRoot(page)
        if (!pageRoot) {
          throw new Error(`Failed to find page root: ${route}`)
        }

        const currentPage = await miniProgram.currentPage()
        expect(currentPage?.path).toBe(pagePath)

        await page.waitFor(500)
        const routeErrors = runtimeEvents.slice(eventCountBeforeRoute)
        if (routeErrors.length > 0) {
          throw new Error(`Runtime errors detected on ${route}\n${routeErrors.join('\n')}`)
        }
      }
    }
    finally {
      miniProgram.removeListener('console', onConsole)
      miniProgram.removeListener('exception', onException)
      await miniProgram.close()
    }
  })
})
