import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/template-wevu-regression')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const LAYOUT_PAGE_WXML = path.join(DIST_ROOT, 'pages/layouts/index.wxml')
const ROUTE = '/pages/layouts/index'
const LEADING_SLASH_RE = /^\/+/

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-regression-layouts',
  })
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runWithTimeout<T>(factory: () => Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let settled = false
  const task = Promise.resolve()
    .then(factory)
    .then((value) => {
      settled = true
      return value
    })
    .catch((error) => {
      settled = true
      throw error
    })

  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout in ${label} after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  }
  finally {
    if (timer) {
      clearTimeout(timer)
    }
    if (!settled) {
      void task.catch(() => {})
    }
  }
}

function shouldRetryAutomatorError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Wait timed out after')
    || message.includes('Timeout in ')
    || message.includes('Execution context was destroyed')
    || message.includes('Target closed')
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
    || message.includes('DevTools did not respond to protocol method App.getCurrentPage')
}

async function runAutomatorOp<T>(
  label: string,
  factory: () => Promise<T>,
  options: { timeoutMs?: number, retries?: number, retryDelayMs?: number } = {},
) {
  const {
    timeoutMs = 8_000,
    retries = 2,
    retryDelayMs = 220,
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await runWithTimeout(factory, timeoutMs, `${label}#${attempt}`)
    }
    catch (error) {
      lastError = error
      if (attempt < retries && shouldRetryAutomatorError(error)) {
        await delay(retryDelayMs)
        continue
      }
      throw error
    }
  }

  throw lastError
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace(LEADING_SLASH_RE, '')
}

async function waitForCurrentPage(miniProgram: any, expectedPath: string, timeoutMs = 15_000) {
  const normalizedExpectedPath = normalizeRoutePath(expectedPath)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await runAutomatorOp('read current page', () => miniProgram.currentPage(), {
        timeoutMs: 5_000,
        retries: 2,
        retryDelayMs: 180,
      })
      if (normalizeRoutePath(String(page?.path ?? '')) === normalizedExpectedPath) {
        return page
      }
      if (typeof page?.waitFor === 'function') {
        await runAutomatorOp('wait current page', () => page.waitFor(220), {
          timeoutMs: 2_000,
          retries: 1,
        }).catch(() => {})
      }
    }
    catch {
    }
    await delay(220)
  }
  return null
}

async function readPageDataSnapshot(page: any) {
  return await runAutomatorOp('read page data snapshot', () => page.data(), {
    timeoutMs: 15_000,
    retries: 2,
    retryDelayMs: 260,
  })
}

async function callCurrentPageMethod(miniProgram: any, methodName: string) {
  const page = await waitForCurrentPage(miniProgram, ROUTE)
  if (!page) {
    throw new Error(`Failed to resolve current page before calling ${methodName}`)
  }

  await runAutomatorOp(`call page method ${methodName}`, () => page.callMethod(methodName), {
    timeoutMs: 8_000,
    retries: 2,
    retryDelayMs: 220,
  })
}

function matchesExpectedProps(
  actual: any,
  expected: Record<string, any> | null,
) {
  if (expected === null) {
    return actual == null || (typeof actual === 'object' && Object.keys(actual).length === 0)
  }
  if (!actual || typeof actual !== 'object') {
    return false
  }
  return Object.entries(expected).every(([key, value]) => actual[key] === value)
}

function matchesExpectedLayoutName(currentLayout: 'default' | 'admin' | 'none', layoutName: unknown) {
  if (currentLayout === 'admin') {
    return layoutName === 'admin'
  }
  if (currentLayout === 'none') {
    return !layoutName || layoutName === '__wv_no_layout'
  }
  return !layoutName || layoutName === 'default'
}

async function waitForLayoutState(
  miniProgram: any,
  options: {
    currentLayout: 'default' | 'admin' | 'none'
    props?: Record<string, any> | null
  },
  timeoutMs = 15_000,
) {
  const start = Date.now()
  let lastSnapshot = 'no snapshot'

  while (Date.now() - start <= timeoutMs) {
    const page = await waitForCurrentPage(miniProgram, ROUTE, 6_000)
    if (!page) {
      lastSnapshot = 'current page unavailable'
      await delay(220)
      continue
    }

    try {
      const data = await readPageDataSnapshot(page)
      const currentLayout = data?.currentLayout
      const layoutName = data?.__wv_page_layout_name
      const props = data?.__wv_page_layout_props
      const propsMatched = options.props === undefined || matchesExpectedProps(props, options.props)
      const layoutNameMatched = matchesExpectedLayoutName(options.currentLayout, layoutName)
      if (currentLayout === options.currentLayout && layoutNameMatched && propsMatched) {
        return { page, currentLayout, layoutName, props }
      }
      lastSnapshot = JSON.stringify({
        currentLayout,
        layoutName,
        props,
      })
    }
    catch (error) {
      lastSnapshot = error instanceof Error ? error.message : String(error)
    }

    await delay(220)
  }

  throw new Error(`Timed out waiting for layout state ${options.currentLayout}: ${lastSnapshot}`)
}

async function assertLayoutTemplateBranches() {
  const wxml = await fs.readFile(LAYOUT_PAGE_WXML, 'utf8')
  expect(wxml).toContain('<weapp-layout-default')
  expect(wxml).toContain('<weapp-layout-admin')
  expect(wxml).toContain('wx:else')
  expect(wxml).toContain('基础模板已接入 src/layouts 约定')
  expect(wxml).toContain('当前状态：{{currentLayout}}')
}

async function expectNoLayoutProps(page: any) {
  const data = await readPageDataSnapshot(page)
  const props = data?.__wv_page_layout_props
  if (props == null) {
    expect(props).toBeFalsy()
    return
  }

  expect(props).toMatchObject({
    title: null,
    subtitle: null,
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: TEMPLATE_ROOT,
      skipRelaunchPageRootCheck: true,
      warmupAllowRelaunch: false,
      warmupAnyPage: true,
    })
  }
  return sharedMiniProgram
}

async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await miniProgram.close().catch(() => {})
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close().catch(() => {})
}

describe.sequential('e2e app: template-wevu-regression layouts runtime', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('switches between default/admin/none layouts at runtime', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const page = await runAutomatorOp(`reLaunch ${ROUTE}`, () => miniProgram.reLaunch(ROUTE), {
        timeoutMs: 20_000,
        retries: 3,
        retryDelayMs: 280,
      })
      if (!page) {
        throw new Error(`Failed to launch route: ${ROUTE}`)
      }
      await assertLayoutTemplateBranches()

      let snapshot = await waitForLayoutState(miniProgram, {
        currentLayout: 'default',
      })
      expect(snapshot.currentLayout).toBe('default')
      await expectNoLayoutProps(snapshot.page)

      await callCurrentPageMethod(miniProgram, 'applyAdminLayout')
      snapshot = await waitForLayoutState(miniProgram, {
        currentLayout: 'admin',
        props: {
          title: '业务后台布局',
          subtitle: '这个标题来自 setPageLayout() 传入的 props。',
        },
      })
      expect(snapshot.currentLayout).toBe('admin')
      expect(snapshot.layoutName).toBe('admin')
      expect(snapshot.props).toMatchObject({
        title: '业务后台布局',
        subtitle: '这个标题来自 setPageLayout() 传入的 props。',
      })

      await callCurrentPageMethod(miniProgram, 'clearLayout')
      snapshot = await waitForLayoutState(miniProgram, {
        currentLayout: 'none',
      })
      expect(snapshot.currentLayout).toBe('none')
      expect(snapshot.layoutName).toBe('__wv_no_layout')
      await expectNoLayoutProps(snapshot.page)

      await callCurrentPageMethod(miniProgram, 'applyDefaultLayout')
      snapshot = await waitForLayoutState(miniProgram, {
        currentLayout: 'default',
      })
      expect(snapshot.currentLayout).toBe('default')
      await expectNoLayoutProps(snapshot.page)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
