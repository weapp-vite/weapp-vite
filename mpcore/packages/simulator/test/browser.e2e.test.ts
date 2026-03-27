import type { Browser, Page } from 'playwright'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import path from 'pathe'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const DEMO_ROOT = path.resolve(ROOT, 'mpcore/demos/web')
const HOST = '127.0.0.1'
const PORT = Number(process.env.MPCORE_SIMULATOR_E2E_PORT ?? 4179)
const URL = `http://${HOST}:${PORT}`

const PLAYWRIGHT_EXECUTABLE = chromium.executablePath()
const CHROMIUM_CHANNEL = process.env.MPCORE_SIMULATOR_E2E_CHANNEL
const PLAYWRIGHT_BUNDLED_AVAILABLE = existsSync(PLAYWRIGHT_EXECUTABLE)
const BROWSER_AVAILABLE = PLAYWRIGHT_BUNDLED_AVAILABLE || Boolean(CHROMIUM_CHANNEL)

const describeE2E = BROWSER_AVAILABLE ? describe : describe.skip
type ExecaChildProcess = ReturnType<typeof execa>

if (!BROWSER_AVAILABLE) {
  process.stderr.write(
    `[simulator-e2e] Skip browser e2e: missing Playwright Chromium at ${PLAYWRIGHT_EXECUTABLE}. `
    + `Install via "pnpm exec playwright install chromium", `
    + `or set MPCORE_SIMULATOR_E2E_CHANNEL=chrome to reuse system Chrome.\n`,
  )
}

async function waitForServerReady(server: ExecaChildProcess, logsRef: { value: string }, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (server.exitCode !== null) {
      throw new Error([
        `[simulator-e2e] Demo server exited early with code ${server.exitCode}.`,
        logsRef.value.trim(),
      ].join('\n'))
    }
    try {
      const response = await fetch(URL)
      if (response.ok) {
        return
      }
    }
    catch {
    }
    await sleep(300)
  }
  throw new Error([
    `[simulator-e2e] Timeout waiting for ${URL}.`,
    logsRef.value.trim(),
  ].join('\n'))
}

function createServerLogger(server: ExecaChildProcess) {
  const logsRef = { value: '' }
  server.stdout?.on('data', (chunk: Uint8Array | string) => {
    logsRef.value += String(chunk)
  })
  server.stderr?.on('data', (chunk: Uint8Array | string) => {
    logsRef.value += String(chunk)
  })
  return logsRef
}

async function stopServer(server?: ExecaChildProcess) {
  if (!server || server.exitCode !== null) {
    return
  }
  server.kill('SIGTERM')
  const forceKillTimer = setTimeout(() => {
    if (server.exitCode === null) {
      server.kill('SIGKILL')
    }
  }, 5_000)
  try {
    await server
  }
  catch {
  }
  finally {
    clearTimeout(forceKillTimer)
  }
}

async function readWorkbenchState(page: Page) {
  return await page.evaluate(() => {
    return (window as any).__SIMULATOR_E2E__?.getState?.() ?? null
  })
}

function parseJsonString<T>(value: string): T {
  return JSON.parse(value) as T
}

async function callWorkbench<T>(page: Page, method: string, ...args: any[]): Promise<T> {
  return await page.evaluate(({ args, method }) => {
    const api = (window as any).__SIMULATOR_E2E__
    const fn = api?.[method]
    if (typeof fn !== 'function') {
      throw new TypeError(`[simulator-e2e] Missing workbench method: ${method}`)
    }
    return fn(...args)
  }, { args, method })
}

async function waitForWorkbench(page: Page) {
  const start = Date.now()
  while (Date.now() - start < 30_000) {
    const ready = await page.evaluate(() => typeof (window as any).__SIMULATOR_E2E__?.getState === 'function')
    if (ready) {
      return
    }
    await sleep(200)
  }
  throw new Error('[simulator-e2e] Timeout waiting for window.__SIMULATOR_E2E__ bridge.')
}

describeE2E.sequential('simulator browser e2e', () => {
  let browser: Browser | undefined
  let page: Page | undefined
  let server: ExecaChildProcess | undefined

  beforeAll(async () => {
    server = execa('pnpm', ['dev', '--host', HOST, '--port', String(PORT)], {
      cwd: DEMO_ROOT,
      env: {
        ...process.env,
        BROWSER: 'none',
      },
    })
    const logsRef = createServerLogger(server)
    await waitForServerReady(server, logsRef)

    browser = await chromium.launch(CHROMIUM_CHANNEL ? { channel: CHROMIUM_CHANNEL } : {})
    page = await browser.newPage()
    await page.goto(URL, { waitUntil: 'domcontentloaded' })
    await waitForWorkbench(page)
  })

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await stopServer(server)
  })

  it('boots the demo with the default scenario and renders a page', async () => {
    const state = await readWorkbenchState(page!)
    expect(state.currentScenarioId).toBe('wechat-template')
    expect(state.currentRoute).toBe('pages/index/index')
    expect(state.pageStack).toEqual(['pages/index/index'])
    expect(state.previewMarkup).toContain('page')
  })

  it('switches scenarios and keeps browser session runtime functional', async () => {
    await callWorkbench(page!, 'pickScenario', 'component-lab')

    await expect.poll(async () => {
      const state = await readWorkbenchState(page!)
      return state.currentScenarioId
    }, { timeout: 20_000 }).toBe('component-lab')

    const state = await readWorkbenchState(page!)
    expect(state.currentRoute).toBe('pages/lab/index')
    expect(state.previewMarkup).toContain('status-card')
    await callWorkbench(page!, 'runPageMethod', 'inspectCard')
    await callWorkbench(page!, 'runPageMethod', 'loadMockQueue')
    await callWorkbench(page!, 'runPageMethod', 'storeSnapshot')
    await callWorkbench(page!, 'runPageMethod', 'toastSnapshot')

    await expect.poll(async () => {
      const nextState = await readWorkbenchState(page!)
      const pageData = parseJsonString<Record<string, any>>(nextState.pageData)
      return Boolean(pageData.componentSnapshot && pageData.requestSnapshot && pageData.storageSnapshot && pageData.toastState)
    }, { timeout: 20_000 }).toBe(true)

    const nextState = await readWorkbenchState(page!)
    const pageData = parseJsonString<Record<string, any>>(nextState.pageData)
    expect(pageData.componentSnapshot).toContain('"size":1')
    expect(pageData.requestSnapshot).toContain('"queue":"alpha"')
    expect(pageData.storageSnapshot).toContain('"status"')
    expect(pageData.toastState).toContain('showToast:ok')
  })

  it('drives browser session host features through the demo workbench api', async () => {
    await callWorkbench(page!, 'pickScenario', 'route-maze')
    await expect.poll(async () => {
      const state = await readWorkbenchState(page!)
      return state.currentScenarioId
    }, { timeout: 20_000 }).toBe('route-maze')

    await callWorkbench(page!, 'runPageMethod', 'openQueue')
    await expect.poll(async () => {
      const state = await readWorkbenchState(page!)
      return state.currentRoute
    }, { timeout: 20_000 }).toBe('package-flow/queue/index')

    await callWorkbench(page!, 'runPageMethod', 'openDetail')
    await expect.poll(async () => {
      const state = await readWorkbenchState(page!)
      return state.currentRoute
    }, { timeout: 20_000 }).toBe('package-flow/detail/index')

    await callWorkbench(page!, 'triggerResize', 390, 844)
    await callWorkbench(page!, 'triggerRouteDone', { from: 'browser-e2e' })
    await callWorkbench(page!, 'triggerPullDownRefresh')
    await callWorkbench(page!, 'triggerReachBottom')
    await callWorkbench(page!, 'navigateBack', 1)

    const state = await readWorkbenchState(page!)
    expect(state.currentRoute).toBe('package-flow/queue/index')
    expect(state.viewportSize).toEqual({ width: 390, height: 844 })

    const snapshot = await callWorkbench<any>(page!, 'sessionSnapshot')
    expect(Array.isArray(snapshot.requestLogs)).toBe(true)
    expect(snapshot.storageSnapshot).toBeTypeOf('object')
  })
})
