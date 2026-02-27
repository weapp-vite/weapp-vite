import type { RuntimeErrorCollector } from './runtimeErrors'
import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { extractConfigFromVue } from '../../packages/weapp-vite/src/utils/file'
import { formatWxml, normalizeWxmlForSnapshot } from '../template-e2e.utils'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/tdesign-miniprogram-starter-retail')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template')
const APP_JSON_PATH = path.resolve(APP_ROOT, 'app.json')
const PROJECT_CONFIG_PATH = path.resolve(APP_ROOT, 'project.config.json')

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

const STRUCTURE_SIMILARITY_THRESHOLD = Number.parseFloat(process.env.RETAIL_PARITY_STRUCTURE_THRESHOLD || '0.93')
const ROUTE_CAPTURE_RETRY_COUNT = 2
const ROUTE_CAPTURE_RETRY_DELAY_MS = 800
const AUTOMATOR_LAUNCH_RETRY_COUNT = 3
const AUTOMATOR_LAUNCH_RETRY_DELAY_MS = 400
const DUMP_WXML = process.env.RETAIL_PARITY_DUMP_WXML === '1'
const DEBUG_ROOT = path.resolve(import.meta.dirname, '../.tmp/retail-parity')
const ROUTE_RENDER_WAIT_MS = Number.parseInt(process.env.RETAIL_PARITY_ROUTE_WAIT_MS || '1200', 10)
const ROUTE_READY_TIMEOUT_MS = Number.parseInt(process.env.RETAIL_PARITY_ROUTE_READY_TIMEOUT_MS || '10000', 10)
const DEBUG_ROUTE = process.env.RETAIL_PARITY_DEBUG_ROUTE?.trim()
const DEBUG_DATA_KEYS = (process.env.RETAIL_PARITY_DEBUG_DATA_KEYS || 'pageLoading,imgSrcs,tabList,goodsList,goodsListLoadStatus')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean)

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

function buildRoute(pagePath: string, query?: string) {
  const normalizedPage = normalizeSegment(pagePath)
  const normalizedQuery = query?.trim()
  if (!normalizedQuery) {
    return `/${normalizedPage}`
  }
  return `/${normalizedPage}?${normalizedQuery}`
}

function tokenizeStructure(wxml: string) {
  const simplified = wxml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>[^<]*</g, '><')
    .replace(/="[^"]*"/g, '=""')
    .replace(/\{\{[^}]+\}\}/g, '{{}}')
    .replace(/\s+/g, ' ')
    .trim()

  // 结构对齐仅比较标签层级，不比较属性细节，避免动态属性导致的误报。
  return simplified.match(/<\/?[\w:-]+/g) ?? []
}

function calcTokenDice(a: string[], b: string[]) {
  if (a.length === 0 && b.length === 0) {
    return 1
  }

  const counts = new Map<string, number>()
  for (const token of a) {
    counts.set(token, (counts.get(token) || 0) + 1)
  }

  let intersection = 0
  for (const token of b) {
    const count = counts.get(token) || 0
    if (count <= 0) {
      continue
    }
    counts.set(token, count - 1)
    intersection += 1
  }

  return (2 * intersection) / (a.length + b.length)
}

function findFirstMismatchLine(left: string, right: string) {
  const leftLines = left.split('\n')
  const rightLines = right.split('\n')
  const max = Math.max(leftLines.length, rightLines.length)
  for (let i = 0; i < max; i += 1) {
    if ((leftLines[i] || '') !== (rightLines[i] || '')) {
      return {
        line: i + 1,
        app: leftLines[i] || '',
        template: rightLines[i] || '',
      }
    }
  }
  return null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
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

async function runBuild(projectRoot: string) {
  const distRoot = path.resolve(projectRoot, 'dist')
  await fs.remove(distRoot)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot,
    platform: 'weapp',
    cwd: projectRoot,
    label: `ide:retail-parity:${path.basename(projectRoot)}`,
  })
}

async function loadTemplateAppConfig() {
  const appJsonPath = path.resolve(TEMPLATE_ROOT, 'src/app.json')
  if (await fs.pathExists(appJsonPath)) {
    return await fs.readJson(appJsonPath)
  }
  const appVuePath = path.resolve(TEMPLATE_ROOT, 'src/app.vue')
  const config = await extractConfigFromVue(appVuePath)
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Failed to load app config from template app.vue')
  }
  return config
}

async function prepareRouteContext(miniProgram: any, pagePath: string) {
  if (pagePath === 'pages/order/order-confirm/index') {
    await miniProgram.callWxMethod('setStorageSync', 'order.goodsRequestList', ORDER_CONFIRM_GOODS_REQUEST_LIST)
  }
}

async function readNormalizedPageWxml(page: any) {
  const rawCandidates: string[] = []

  if (typeof page.$$ === 'function') {
    try {
      const pageRoots = await page.$$('page')
      for (const root of pageRoots || []) {
        try {
          const rawWxml = await root.wxml()
          if (rawWxml) {
            rawCandidates.push(rawWxml)
          }
        }
        catch {
          // ignore single root read errors, fallback to other roots
        }
      }
    }
    catch {
      // ignore query errors and fallback to legacy single-root logic
    }
  }

  if (rawCandidates.length === 0) {
    const pageRoot = await waitForPageRoot(page)
    if (!pageRoot) {
      throw new Error('Failed to find page root')
    }
    rawCandidates.push(await pageRoot.wxml())
  }

  const selected = rawCandidates.sort((left, right) => right.length - left.length)[0]
  const wxml = normalizeWxmlForSnapshot(selected)
  return await formatWxml(wxml)
}

async function wait(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

function ensureNoRuntimeErrors(options: {
  errorCollector: RuntimeErrorCollector
  marker: number
  route: string
  stage: string
}) {
  const { errorCollector, marker, route, stage } = options
  const routeErrors = errorCollector.getSince(marker)
  if (routeErrors.length > 0) {
    throw new Error(`[retail-parity] runtime errors detected route=${route} stage=${stage}\n${routeErrors.join('\n')}`)
  }
}

async function waitForRouteReady(options: {
  page: any
  pagePath: string
  route: string
  errorCollector: RuntimeErrorCollector
  marker: number
  projectName: string
}) {
  const {
    page,
    pagePath,
    route,
    errorCollector,
    marker,
    projectName,
  } = options

  if (pagePath === 'pages/cart/index') {
    let lastState: {
      isNotEmpty: unknown
      storeCount: number | null
      invalidCount: number | null
      hasCartGroup: boolean
      hasCartEmpty: boolean
      dataError?: string
      wxmlError?: string
    } = {
      isNotEmpty: undefined,
      storeCount: null,
      invalidCount: null,
      hasCartGroup: false,
      hasCartEmpty: false,
    }

    const start = Date.now()
    while (Date.now() - start <= ROUTE_READY_TIMEOUT_MS) {
      ensureNoRuntimeErrors({
        errorCollector,
        marker,
        route,
        stage: 'wait-ready',
      })

      let dataError: string | undefined
      let nextCartGroupData: any = null
      try {
        nextCartGroupData = await page.data('cartGroupData')
      }
      catch (error) {
        dataError = getErrorMessage(error)
      }

      const storeCount = Array.isArray(nextCartGroupData?.storeGoods) ? nextCartGroupData.storeGoods.length : null
      const invalidCount = Array.isArray(nextCartGroupData?.invalidGoodItems)
        ? nextCartGroupData.invalidGoodItems.length
        : null
      const isNotEmpty = nextCartGroupData?.isNotEmpty
      let hasCartGroup = false
      let hasCartEmpty = false
      let wxmlError: string | undefined
      const pageRoot = await waitForPageRoot(page, 1000)
      if (pageRoot) {
        try {
          const rawWxml = await pageRoot.wxml()
          hasCartGroup = rawWxml.includes('<cart-group') || rawWxml.includes('cart-group')
          hasCartEmpty = rawWxml.includes('<cart-empty') || rawWxml.includes('cart-empty')
        }
        catch (error) {
          wxmlError = getErrorMessage(error)
        }
      }
      lastState = {
        isNotEmpty,
        storeCount,
        invalidCount,
        hasCartGroup,
        hasCartEmpty,
        dataError,
        wxmlError,
      }

      if (((storeCount !== null && storeCount > 0) || (invalidCount !== null && invalidCount > 0)) && hasCartGroup) {
        return
      }

      await page.waitFor(200)
    }

    const routeErrors = errorCollector.getSince(marker)
    throw new Error(
      `[retail-parity] route not ready within timeout: ${pagePath} route=${route} project=${projectName} state=${JSON.stringify(lastState)} runtimeErrors=${JSON.stringify(routeErrors)}`,
    )
  }

  if (pagePath !== 'pages/home/home') {
    return
  }

  let lastState: {
    listLength: number | null
    status: unknown
    hasGoodsCard: boolean
    hasPageRoot: boolean
    dataError?: string
    wxmlError?: string
  } = {
    listLength: null,
    status: undefined,
    hasGoodsCard: false,
    hasPageRoot: false,
  }

  const start = Date.now()
  while (Date.now() - start <= ROUTE_READY_TIMEOUT_MS) {
    ensureNoRuntimeErrors({
      errorCollector,
      marker,
      route,
      stage: 'wait-ready',
    })

    let list: unknown
    let status: unknown
    let dataError: string | undefined
    try {
      list = await page.data('goodsList')
      status = await page.data('goodsListLoadStatus')
    }
    catch (error) {
      dataError = getErrorMessage(error)
    }

    let hasGoodsCard = false
    let hasPageRoot = false
    let wxmlError: string | undefined
    const pageRoot = await waitForPageRoot(page, 1000)
    if (pageRoot) {
      hasPageRoot = true
      try {
        const rawWxml = await pageRoot.wxml()
        hasGoodsCard = rawWxml.includes('<goods-card') || rawWxml.includes('goods-card')
      }
      catch (error) {
        wxmlError = getErrorMessage(error)
      }
    }

    const normalizedStatus = Number(status)
    const listLength = Array.isArray(list) ? list.length : null
    lastState = {
      listLength,
      status,
      hasGoodsCard,
      hasPageRoot,
      dataError,
      wxmlError,
    }

    if (listLength !== null && listLength > 0 && normalizedStatus === 0 && hasGoodsCard) {
      return
    }

    await page.waitFor(200)
  }

  const routeErrors = errorCollector.getSince(marker)
  throw new Error(
    `[retail-parity] route not ready within timeout: ${pagePath} route=${route} project=${projectName} state=${JSON.stringify(lastState)} runtimeErrors=${JSON.stringify(routeErrors)}`,
  )
}

function isPortInUseError(error: unknown) {
  return /Port \d+ is in use, please specify another port/.test(getErrorMessage(error))
}

async function launchAutomatorWithRetry(projectPath: string) {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= AUTOMATOR_LAUNCH_RETRY_COUNT; attempt += 1) {
    try {
      return await launchAutomator({
        projectPath,
        timeout: 120_000,
      })
    }
    catch (error) {
      lastError = error
      if (!isPortInUseError(error) || attempt >= AUTOMATOR_LAUNCH_RETRY_COUNT) {
        throw error
      }
      await wait(AUTOMATOR_LAUNCH_RETRY_DELAY_MS)
    }
  }
  throw new Error(`[retail-parity] failed to launch automator for ${projectPath}: ${getErrorMessage(lastError)}`)
}

interface SharedProjectSession {
  miniProgram: any
  errorCollector: RuntimeErrorCollector
}

const sharedProjectSessions = new Map<string, SharedProjectSession>()

async function getSharedProjectSession(projectRoot: string) {
  const existing = sharedProjectSessions.get(projectRoot)
  if (existing) {
    return existing
  }

  const miniProgram = await launchAutomatorWithRetry(projectRoot)
  const errorCollector = attachRuntimeErrorCollector(miniProgram)
  const session: SharedProjectSession = {
    miniProgram,
    errorCollector,
  }
  sharedProjectSessions.set(projectRoot, session)
  return session
}

async function closeSharedProjectSessions() {
  const sessions = Array.from(sharedProjectSessions.values())
  sharedProjectSessions.clear()
  for (const session of sessions) {
    session.errorCollector.dispose()
  }
  await Promise.allSettled(sessions.map(session => session.miniProgram.close()))
}

async function captureRouteWxml(options: {
  miniProgram: any
  projectName: string
  route: string
  pagePath: string
  errorCollector: RuntimeErrorCollector
}) {
  const { miniProgram, projectName, route, pagePath, errorCollector } = options
  let lastError: unknown = null

  for (let attempt = 1; attempt <= ROUTE_CAPTURE_RETRY_COUNT; attempt += 1) {
    try {
      const marker = errorCollector.mark()
      await prepareRouteContext(miniProgram, pagePath)
      const page = await miniProgram.reLaunch(route)
      if (!page) {
        throw new Error(`reLaunch returned empty page: ${route}`)
      }
      ensureNoRuntimeErrors({
        errorCollector,
        marker,
        route,
        stage: 'after-reLaunch',
      })
      await page.waitFor(Number.isFinite(ROUTE_RENDER_WAIT_MS) ? ROUTE_RENDER_WAIT_MS : 1200)
      ensureNoRuntimeErrors({
        errorCollector,
        marker,
        route,
        stage: 'after-route-wait',
      })
      await waitForRouteReady({
        page,
        pagePath,
        route,
        errorCollector,
        marker,
        projectName,
      })
      ensureNoRuntimeErrors({
        errorCollector,
        marker,
        route,
        stage: 'after-ready',
      })
      if (DEBUG_ROUTE && DEBUG_ROUTE === pagePath) {
        const debugData: Record<string, unknown> = {}
        for (const key of DEBUG_DATA_KEYS) {
          try {
            debugData[key] = await page.data(key)
          }
          catch (error) {
            debugData[key] = `[data error] ${getErrorMessage(error)}`
          }
        }
        // eslint-disable-next-line no-console
        console.info(`[retail-parity] debug data project=${projectName} route=${route} data=${JSON.stringify(debugData)}`)
      }
      ensureNoRuntimeErrors({
        errorCollector,
        marker,
        route,
        stage: 'before-wxml-read',
      })
      return await readNormalizedPageWxml(page)
    }
    catch (error) {
      lastError = error
      // eslint-disable-next-line no-console
      console.warn(
        `[retail-parity] ${projectName} capture failed route=${route} attempt=${attempt}/${ROUTE_CAPTURE_RETRY_COUNT} error=${getErrorMessage(error)}`,
      )
      if (attempt < ROUTE_CAPTURE_RETRY_COUNT) {
        await wait(ROUTE_CAPTURE_RETRY_DELAY_MS)
      }
    }
  }

  throw new Error(
    `[retail-parity] ${projectName} failed to capture route=${route}: ${getErrorMessage(lastError)}`,
  )
}

async function captureProjectPagesWxml(options: {
  projectRoot: string
  projectName: string
  pages: string[]
  launchQueryMap: Map<string, string>
}) {
  const { projectRoot, projectName, pages, launchQueryMap } = options
  const { miniProgram, errorCollector } = await getSharedProjectSession(projectRoot)
  const pageWxmlMap = new Map<string, string>()
  for (const pagePath of pages) {
    const route = buildRoute(pagePath, launchQueryMap.get(pagePath))
    const wxml = await captureRouteWxml({
      miniProgram,
      projectName,
      route,
      pagePath,
      errorCollector,
    })
    pageWxmlMap.set(pagePath, wxml)
  }
  return pageWxmlMap
}

async function dumpCapturedWxml(
  pagePath: string,
  appWxml: string,
  templateWxml: string,
) {
  if (!DUMP_WXML) {
    return
  }
  const safePagePath = pagePath.replace(/\//g, '__')
  await fs.ensureDir(DEBUG_ROOT)
  await Promise.all([
    fs.writeFile(path.resolve(DEBUG_ROOT, `${safePagePath}.app.wxml`), appWxml, 'utf8'),
    fs.writeFile(path.resolve(DEBUG_ROOT, `${safePagePath}.template.wxml`), templateWxml, 'utf8'),
  ])
}

describe.sequential('template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template parity', () => {
  afterAll(async () => {
    await closeSharedProjectSessions()
  })

  it('keeps WXML DOM structure aligned with tdesign-miniprogram-starter-retail', async () => {
    const [appConfig, templateAppConfig, projectConfig] = await Promise.all([
      fs.readJson(APP_JSON_PATH),
      loadTemplateAppConfig(),
      fs.readJson(PROJECT_CONFIG_PATH),
    ])
    const appPages = resolvePages(appConfig)
    const templatePages = resolvePages(templateAppConfig)
    expect(templatePages).toEqual(appPages)
    const onlyPage = process.env.RETAIL_PARITY_ONLY_PAGE?.trim()
    const pagesToCompare = onlyPage ? appPages.filter(page => page === onlyPage) : appPages
    if (onlyPage) {
      expect(pagesToCompare.length).toBe(1)
    }

    const launchQueryMap = resolveLaunchQueryMap(projectConfig)
    for (const [pagePath, query] of ROUTE_QUERY_OVERRIDES) {
      launchQueryMap.set(pagePath, query)
    }

    await Promise.all([
      runBuild(APP_ROOT),
      runBuild(TEMPLATE_ROOT),
    ])

    const appWxmlMap = await captureProjectPagesWxml({
      projectRoot: APP_ROOT,
      projectName: 'app',
      pages: pagesToCompare,
      launchQueryMap,
    })
    const templateWxmlMap = await captureProjectPagesWxml({
      projectRoot: TEMPLATE_ROOT,
      projectName: 'template',
      pages: pagesToCompare,
      launchQueryMap,
    })

    const comparisons: Array<{
      pagePath: string
      similarity: number
    }> = []
    const mismatches: Array<{
      pagePath: string
      similarity: number
      mismatchLine: ReturnType<typeof findFirstMismatchLine>
    }> = []

    for (const pagePath of pagesToCompare) {
      const appWxml = appWxmlMap.get(pagePath)
      const templateWxml = templateWxmlMap.get(pagePath)
      if (!appWxml || !templateWxml) {
        throw new Error(`missing captured wxml for page=${pagePath}`)
      }

      const similarity = calcTokenDice(tokenizeStructure(appWxml), tokenizeStructure(templateWxml))
      comparisons.push({ pagePath, similarity })
      if (similarity < STRUCTURE_SIMILARITY_THRESHOLD) {
        await dumpCapturedWxml(pagePath, appWxml, templateWxml)
        mismatches.push({
          pagePath,
          similarity,
          mismatchLine: findFirstMismatchLine(appWxml, templateWxml),
        })
      }
    }

    const avgSimilarity = comparisons.length > 0
      ? comparisons.reduce((sum, item) => sum + item.similarity, 0) / comparisons.length
      : 0
    const minSimilarity = comparisons.reduce((min, item) => Math.min(min, item.similarity), 1)
    // Keep a concise summary in test output for report generation.
    // eslint-disable-next-line no-console
    console.info(`[retail-parity] compared pages=${pagesToCompare.length} mismatches=${mismatches.length} avgSimilarity=${avgSimilarity.toFixed(6)} minSimilarity=${minSimilarity.toFixed(6)}`)
    if (mismatches.length > 0) {
      // eslint-disable-next-line no-console
      console.info(`[retail-parity] mismatches=${JSON.stringify(mismatches, null, 2)}`)
    }
    // eslint-disable-next-line no-console
    console.info(`[retail-parity] similarities=${JSON.stringify(comparisons, null, 2)}`)

    expect(mismatches).toEqual([])
  })
})
