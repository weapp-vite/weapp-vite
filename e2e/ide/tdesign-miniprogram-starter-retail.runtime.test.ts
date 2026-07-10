import { Buffer } from 'node:buffer'
import { inflateSync } from 'node:zlib'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/tdesign-miniprogram-starter-retail')
const APP_JSON_PATH = path.resolve(APP_ROOT, 'app.json')
const PROJECT_CONFIG_PATH = path.resolve(APP_ROOT, 'project.config.json')
const DIST_ROOT = path.resolve(APP_ROOT, 'dist')
const ROUTE_FILTER_ENV = 'WEAPP_VITE_E2E_TDESIGN_RETAIL_ROUTE_FILTER'
const DEVTOOLS_UNSTABLE_INITIAL_ROUTES = new Set([
  'pages/home/home',
])

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

function filterPagesForDebug(pagePaths: string[]) {
  const filter = process.env[ROUTE_FILTER_ENV]?.trim()
  const stablePagePaths = pagePaths.filter(pagePath => !DEVTOOLS_UNSTABLE_INITIAL_ROUTES.has(pagePath))
  if (!filter) {
    return stablePagePaths
  }
  return stablePagePaths.filter(pagePath => pagePath.includes(filter))
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

function resolveTabBarPages(config: Record<string, any>) {
  const list = config?.tabBar?.list
  if (!Array.isArray(list)) {
    return new Set<string>()
  }

  return new Set(
    list
      .map((item: any) => typeof item?.pagePath === 'string' ? normalizeSegment(item.pagePath) : '')
      .filter(Boolean),
  )
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

function isRecoverableRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /getPageMetaByWebviewId|DEVTOOLS_PROTOCOL_TIMEOUT|DevTools did not respond to protocol method|Connection closed|Target closed|WebSocket is not open|socket hang up|Execution context was destroyed|Timeout in .*?reLaunch/i.test(message)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function resolveRoutePage(miniProgram: any, route: string, pagePath: string, preferCurrentPage: boolean, isTabBarPage: boolean) {
  if (preferCurrentPage) {
    let lastError: unknown
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      try {
        const currentPage = await miniProgram.currentPage()
        if (currentPage) {
          return currentPage
        }
      }
      catch (error) {
        lastError = error
        if (!isRecoverableRouteError(error)) {
          throw error
        }
      }
      await sleep(1_000)
    }
    if (lastError) {
      throw lastError
    }
    throw new Error(`Failed to read current page for initial route: ${pagePath}`)
  }
  if (isTabBarPage) {
    return await miniProgram.switchTab(`/${pagePath}`)
  }
  return await miniProgram.reLaunch(route)
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

let sharedMiniProgram: any = null
let sharedBuildPrepared = false
const AUTOMATOR_LAUNCH_RETRIES = 3
const AUTOMATOR_LAUNCH_RETRY_DELAY = 1_200
const AUTOMATOR_LAUNCH_TIMEOUT = 45_000
const PAGE_RENDERED_TIMEOUT = 12_000
const PAGE_RENDERED_POLL_DELAY = 300
const RUNTIME_SELECTOR_LIMIT = 8
const STABLE_SELECTOR_TOKEN_RE = /^-?[_a-z][\w-]*$/i
const PNG_SIGNATURE = '89504e470d0a1a0a'

function pushStableRuntimeSelector(selectors: string[], seen: Set<string>, selector: string) {
  if (!selector || seen.has(selector)) {
    return
  }
  seen.add(selector)
  selectors.push(selector)
}

function extractRuntimeSelectorsFromWxml(wxml: string) {
  const selectors: string[] = []
  const seen = new Set<string>()

  for (const match of wxml.matchAll(/\sid="([^"]+)"/g)) {
    const id = match[1]?.trim()
    if (id && STABLE_SELECTOR_TOKEN_RE.test(id)) {
      pushStableRuntimeSelector(selectors, seen, `#${id}`)
    }
  }

  for (const match of wxml.matchAll(/\sclass="([^"]+)"/g)) {
    const classValue = match[1] ?? ''
    for (const token of classValue.split(/\s+/)) {
      const normalized = token.trim()
      if (STABLE_SELECTOR_TOKEN_RE.test(normalized)) {
        pushStableRuntimeSelector(selectors, seen, `.${normalized}`)
      }
      if (selectors.length >= RUNTIME_SELECTOR_LIMIT) {
        return selectors
      }
    }
  }

  return selectors
}

async function resolveRuntimeSelectors(pagePath: string) {
  const wxmlPath = path.join(DIST_ROOT, `${pagePath}.wxml`)
  const wxml = await fs.readFile(wxmlPath, 'utf8')
  return extractRuntimeSelectorsFromWxml(wxml)
}

async function waitForRuntimeRendered(page: any, route: string, selectors: string[]) {
  const startedAt = Date.now()
  const candidates = selectors.length > 0 ? selectors : ['view']
  let latest: unknown = null
  let lastError: unknown

  while (Date.now() - startedAt <= PAGE_RENDERED_TIMEOUT) {
    for (const selector of candidates) {
      try {
        if (typeof page.renderedNodes === 'function') {
          const nodes = await page.renderedNodes(selector, {
            timeout: Math.min(2_000, Math.max(1, PAGE_RENDERED_TIMEOUT - (Date.now() - startedAt))),
          })
          latest = {
            nodes,
            selector,
          }
          if (Array.isArray(nodes) && nodes.some(node => Number(node?.width ?? 0) > 0 && Number(node?.height ?? 0) > 0)) {
            return
          }
        }
      }
      catch (error) {
        lastError = error
      }
    }
    await sleep(PAGE_RENDERED_POLL_DELAY)
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError ?? 'condition not met')
  throw new Error(`Failed to find rendered nodes: ${route} selectors=${candidates.join(',')} reason=${reason} latest=${JSON.stringify(latest).slice(0, 500)}`)
}

function paethPredictor(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const upLeftDistance = Math.abs(estimate - upLeft)
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left
  }
  return upDistance <= upLeftDistance ? up : upLeft
}

function analyzePngScreenshot(base64: string) {
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) {
    throw new Error('Screenshot is not a PNG image')
  }

  let offset = 8
  let width = 0
  let height = 0
  let colorType = 0
  const idatChunks: Buffer[] = []

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    const data = buffer.subarray(dataStart, dataEnd)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9] ?? 0
    }
    else if (type === 'IDAT') {
      idatChunks.push(data)
    }
    else if (type === 'IEND') {
      break
    }
    offset = dataEnd + 4
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0
  if (!width || !height || !channels) {
    throw new Error(`Unsupported screenshot PNG format: width=${width} height=${height} colorType=${colorType}`)
  }

  const inflated = inflateSync(Buffer.concat(idatChunks))
  const rowLength = width * channels
  const previous = Buffer.alloc(rowLength)
  const current = Buffer.alloc(rowLength)
  const colors = new Set<string>()
  let sourceOffset = 0

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset]
    sourceOffset += 1
    inflated.copy(current, 0, sourceOffset, sourceOffset + rowLength)
    sourceOffset += rowLength
    for (let index = 0; index < rowLength; index += 1) {
      const left = index >= channels ? current[index - channels]! : 0
      const up = previous[index] ?? 0
      const upLeft = index >= channels ? previous[index - channels]! : 0
      if (filter === 1) {
        current[index] = (current[index]! + left) & 0xFF
      }
      else if (filter === 2) {
        current[index] = (current[index]! + up) & 0xFF
      }
      else if (filter === 3) {
        current[index] = (current[index]! + Math.floor((left + up) / 2)) & 0xFF
      }
      else if (filter === 4) {
        current[index] = (current[index]! + paethPredictor(left, up, upLeft)) & 0xFF
      }
    }
    const sampleStep = Math.max(channels, Math.floor(rowLength / 80 / channels) * channels)
    for (let index = 0; index < rowLength; index += sampleStep) {
      const red = current[index] ?? 0
      const green = channels === 1 ? red : current[index + 1] ?? 0
      const blue = channels === 1 ? red : current[index + 2] ?? 0
      const alpha = channels === 4 ? current[index + 3] ?? 255 : 255
      colors.add(`${red},${green},${blue},${alpha}`)
      if (colors.size >= 8) {
        return { colorCount: colors.size, height, width }
      }
    }
    current.copy(previous)
  }

  return { colorCount: colors.size, height, width }
}

async function assertScreenshotRendered(miniProgram: any, route: string) {
  const screenshot = await miniProgram.screenshot({ timeout: 12_000 })
  const analysis = analyzePngScreenshot(screenshot)
  expect(analysis.width, `invalid screenshot width: ${route}`).toBeGreaterThan(100)
  expect(analysis.height, `invalid screenshot height: ${route}`).toBeGreaterThan(100)
  expect(analysis.colorCount, `blank screenshot: ${route}`).toBeGreaterThan(1)
}

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    let lastError: unknown
    for (let attempt = 1; attempt <= AUTOMATOR_LAUNCH_RETRIES; attempt += 1) {
      try {
        sharedMiniProgram = await launchAutomator({
          projectPath: APP_ROOT,
          projectConfig: {
            setting: {
              useIsolateContext: false,
              useMultiFrameRuntime: false,
            },
          },
          skipRelaunchPageRootCheck: true,
          skipWarmup: true,
          timeout: AUTOMATOR_LAUNCH_TIMEOUT,
        })
        break
      }
      catch (error) {
        lastError = error
        if (attempt >= AUTOMATOR_LAUNCH_RETRIES) {
          throw lastError
        }
        await sleep(AUTOMATOR_LAUNCH_RETRY_DELAY * attempt)
      }
    }
  }
  return sharedMiniProgram
}

async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await miniProgram.close()
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe.sequential('e2e app: tdesign-miniprogram-starter-retail', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it.skip('loads every page from app config without runtime errors', async () => {
    const appConfig = await fs.readJson(APP_JSON_PATH)
    const projectConfig = await fs.readJson(PROJECT_CONFIG_PATH)
    const pagePaths = filterPagesForDebug(resolvePages(appConfig))
    const tabBarPages = resolveTabBarPages(appConfig)
    const launchQueryMap = resolveLaunchQueryMap(projectConfig)
    for (const [pagePath, query] of ROUTE_QUERY_OVERRIDES) {
      launchQueryMap.set(pagePath, query)
    }

    if (pagePaths.length === 0) {
      throw new Error('No pages found in app.json')
    }

    const miniProgram = await getSharedMiniProgram()

    const runtimeEvents: string[] = []
    const onConsole = (entry: any) => {
      if (isErrorConsoleEntry(entry)) {
        runtimeEvents.push(formatRuntimeEntry('console', entry))
      }
    }
    const onException = (entry: any) => {
      runtimeEvents.push(formatRuntimeEntry('exception', entry))
    }

    let activeMiniProgram = miniProgram

    function attachRuntimeCollectors(target: any) {
      target.on('console', onConsole)
      target.on('exception', onException)
    }

    function detachRuntimeCollectors(target: any) {
      target.removeListener('console', onConsole)
      target.removeListener('exception', onException)
    }

    attachRuntimeCollectors(activeMiniProgram)

    try {
      for (const [pageIndex, pagePath] of pagePaths.entries()) {
        const route = buildRoute(pagePath, launchQueryMap.get(pagePath))
        let lastError: unknown
        process.stdout.write(`[tdesign-retail-runtime] route ${pageIndex + 1}/${pagePaths.length} ${route}\n`)

        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            await prepareRouteContext(activeMiniProgram, pagePath)
            const eventCountBeforeRoute = runtimeEvents.length

            const page = await resolveRoutePage(activeMiniProgram, route, pagePath, DEVTOOLS_UNSTABLE_INITIAL_ROUTES.has(pagePath), tabBarPages.has(pagePath))
            if (!page) {
              throw new Error(`Failed to launch page: ${route}`)
            }

            const currentPage = await activeMiniProgram.currentPage().catch(() => page)
            expect(normalizeSegment(currentPage?.path ?? page?.path ?? '')).toBe(pagePath)

            try {
              await waitForRuntimeRendered(page, route, await resolveRuntimeSelectors(pagePath))
            }
            catch (error) {
              if (!String(error instanceof Error ? error.message : error).includes('Failed to find rendered nodes')) {
                throw error
              }
              await assertScreenshotRendered(activeMiniProgram, route)
            }

            await page.waitFor(500)
            const routeErrors = runtimeEvents.slice(eventCountBeforeRoute)
            if (routeErrors.length > 0) {
              throw new Error(`Runtime errors detected on ${route}\n${routeErrors.join('\n')}`)
            }
            lastError = undefined
            break
          }
          catch (error) {
            lastError = error
            if (attempt >= 2 || !isRecoverableRouteError(error)) {
              const message = error instanceof Error ? error.message : String(error)
              throw new Error(`Failed to verify route ${route} attempt=${attempt}: ${message}`)
            }
            detachRuntimeCollectors(activeMiniProgram)
            await closeSharedMiniProgram()
            await cleanDevtoolsCache('all', { cwd: APP_ROOT })
            await cleanupResidualIdeProcesses()
            activeMiniProgram = await getSharedMiniProgram()
            attachRuntimeCollectors(activeMiniProgram)
          }
        }

        if (lastError) {
          throw lastError
        }
      }
    }
    finally {
      detachRuntimeCollectors(activeMiniProgram)
      await releaseSharedMiniProgram(activeMiniProgram)
    }
  })
})
