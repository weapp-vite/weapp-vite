import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { extractConfigFromVue } from '../../packages/weapp-vite/src/utils/file'
import { formatWxml, normalizeWxmlForSnapshot } from '../template-e2e.utils'
import { launchAutomator } from '../utils/automator'

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

const STRUCTURE_SIMILARITY_THRESHOLD = 0.995
const ROUTE_CAPTURE_RETRY_COUNT = 2
const ROUTE_CAPTURE_RETRY_DELAY_MS = 800

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

  return simplified.match(/<\/?[\w:-]+|[\w:-]+=/g) ?? []
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
  await execa('node', [CLI_PATH, 'build', projectRoot, '--platform', 'weapp'], {
    stdio: 'inherit',
    cwd: projectRoot,
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
  const pageRoot = await waitForPageRoot(page)
  if (!pageRoot) {
    throw new Error('Failed to find page root')
  }
  const wxml = normalizeWxmlForSnapshot(await pageRoot.wxml())
  return await formatWxml(wxml)
}

async function wait(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function captureRouteWxml(options: {
  miniProgram: any
  projectName: string
  route: string
  pagePath: string
}) {
  const { miniProgram, projectName, route, pagePath } = options
  let lastError: unknown = null

  for (let attempt = 1; attempt <= ROUTE_CAPTURE_RETRY_COUNT; attempt += 1) {
    try {
      await prepareRouteContext(miniProgram, pagePath)
      const page = await miniProgram.reLaunch(route)
      if (!page) {
        throw new Error(`reLaunch returned empty page: ${route}`)
      }
      await page.waitFor(500)
      return await readNormalizedPageWxml(page)
    }
    catch (error) {
      lastError = error
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

describe.sequential('template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template parity', () => {
  it('keeps WXML DOM structure aligned with tdesign-miniprogram-starter-retail', async () => {
    const [appConfig, templateAppConfig, projectConfig] = await Promise.all([
      fs.readJson(APP_JSON_PATH),
      loadTemplateAppConfig(),
      fs.readJson(PROJECT_CONFIG_PATH),
    ])
    const appPages = resolvePages(appConfig)
    const templatePages = resolvePages(templateAppConfig)
    expect(templatePages).toEqual(appPages)

    const launchQueryMap = resolveLaunchQueryMap(projectConfig)
    for (const [pagePath, query] of ROUTE_QUERY_OVERRIDES) {
      launchQueryMap.set(pagePath, query)
    }

    await Promise.all([
      runBuild(APP_ROOT),
      runBuild(TEMPLATE_ROOT),
    ])

    const [appMiniProgram, templateMiniProgram] = await Promise.all([
      launchAutomator({ projectPath: APP_ROOT, port: 9420, timeout: 120_000 }),
      launchAutomator({ projectPath: TEMPLATE_ROOT, port: 9421, timeout: 120_000 }),
    ])

    const comparisons: Array<{
      pagePath: string
      similarity: number
    }> = []
    const mismatches: Array<{
      pagePath: string
      similarity: number
      mismatchLine: ReturnType<typeof findFirstMismatchLine>
    }> = []

    try {
      for (const pagePath of appPages) {
        const route = buildRoute(pagePath, launchQueryMap.get(pagePath))
        const appWxml = await captureRouteWxml({
          miniProgram: appMiniProgram,
          projectName: 'app',
          route,
          pagePath,
        })
        const templateWxml = await captureRouteWxml({
          miniProgram: templateMiniProgram,
          projectName: 'template',
          route,
          pagePath,
        })

        const similarity = calcTokenDice(tokenizeStructure(appWxml), tokenizeStructure(templateWxml))
        comparisons.push({ pagePath, similarity })
        if (similarity < STRUCTURE_SIMILARITY_THRESHOLD) {
          mismatches.push({
            pagePath,
            similarity,
            mismatchLine: findFirstMismatchLine(appWxml, templateWxml),
          })
        }
      }
    }
    finally {
      await Promise.allSettled([
        appMiniProgram.close(),
        templateMiniProgram.close(),
      ])
    }

    const avgSimilarity = comparisons.length > 0
      ? comparisons.reduce((sum, item) => sum + item.similarity, 0) / comparisons.length
      : 0
    const minSimilarity = comparisons.reduce((min, item) => Math.min(min, item.similarity), 1)
    // Keep a concise summary in test output for report generation.
    console.info(`[retail-parity] compared pages=${appPages.length} mismatches=${mismatches.length} avgSimilarity=${avgSimilarity.toFixed(6)} minSimilarity=${minSimilarity.toFixed(6)}`)
    if (mismatches.length > 0) {
      console.info(`[retail-parity] mismatches=${JSON.stringify(mismatches, null, 2)}`)
    }
    console.info(`[retail-parity] similarities=${JSON.stringify(comparisons, null, 2)}`)

    expect(mismatches).toEqual([])
  })
})
