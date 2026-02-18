import type { ExecaChildProcess } from 'execa'
import type { Browser, Page } from 'playwright'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { execa } from 'execa'
import path from 'pathe'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '../..')
const WEB_DEMO_ROOT = path.resolve(ROOT, 'apps/weapp-vite-web-demo')
const CLI_PATH = path.resolve(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const WEB_HOST = '127.0.0.1'
const WEB_PORT = Number(process.env.WEAPP_VITE_WEB_E2E_PORT ?? 5180)
const WEB_URL = `http://${WEB_HOST}:${WEB_PORT}`
const BUTTON_LIKE_SELECTOR = 'button, weapp-button, [role="button"]'

const PLAYWRIGHT_EXECUTABLE = chromium.executablePath()
const CHROMIUM_CHANNEL = process.env.WEAPP_VITE_WEB_E2E_CHANNEL
const PLAYWRIGHT_BUNDLED_AVAILABLE = existsSync(PLAYWRIGHT_EXECUTABLE)
const BROWSER_AVAILABLE = PLAYWRIGHT_BUNDLED_AVAILABLE || Boolean(CHROMIUM_CHANNEL)

const describeWeb = BROWSER_AVAILABLE ? describe : describe.skip

if (!BROWSER_AVAILABLE) {
  process.stderr.write(
    `[web-e2e] Skip browser baseline: missing Playwright Chromium at ${PLAYWRIGHT_EXECUTABLE}. `
    + `You can install it via "pnpm exec playwright install chromium", `
    + `or set WEAPP_VITE_WEB_E2E_CHANNEL=chrome to reuse system Chrome.\n`,
  )
}

async function waitForWebServerReady(server: ExecaChildProcess, logsRef: { value: string }, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (server.exitCode !== null) {
      throw new Error([
        `[web-e2e] Web dev server exited early with code ${server.exitCode}.`,
        logsRef.value.trim(),
      ].join('\n'))
    }
    try {
      const response = await fetch(WEB_URL)
      if (response.ok) {
        return
      }
    }
    catch {
    }
    await sleep(300)
  }
  throw new Error([
    `[web-e2e] Timeout waiting for ${WEB_URL}.`,
    logsRef.value.trim(),
  ].join('\n'))
}

function createServerLogger(server: ExecaChildProcess) {
  const logsRef = { value: '' }
  server.stdout?.on('data', (chunk) => {
    logsRef.value += String(chunk)
  })
  server.stderr?.on('data', (chunk) => {
    logsRef.value += String(chunk)
  })
  return logsRef
}

async function stopWebServer(server?: ExecaChildProcess) {
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

async function findAndClickByText(page: Page, selector: string, text: string) {
  const timeoutMs = 15_000
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const target = await page.evaluate(({ selector, text }) => {
      const collectMatches = (root: ParentNode): HTMLElement[] => {
        const matches = Array.from(root.querySelectorAll(selector))
          .filter((element): element is HTMLElement => element instanceof HTMLElement)
        const hosts = Array.from(root.querySelectorAll('*')) as HTMLElement[]
        for (const host of hosts) {
          if (host.shadowRoot) {
            matches.push(...collectMatches(host.shadowRoot))
          }
        }
        return matches
      }

      const isVisible = (element: HTMLElement) => {
        const style = getComputedStyle(element)
        if (style.visibility === 'hidden' || style.display === 'none') {
          return false
        }
        if (element.hidden || element.hasAttribute('hidden')) {
          return false
        }
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }

      const visibleTarget = collectMatches(document).find((element) => {
        return isVisible(element) && (element.textContent ?? '').includes(text)
      })
      if (!visibleTarget) {
        return null
      }

      const rect = visibleTarget.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null
      }
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
        return null
      }
      return { x, y }
    }, { selector, text })

    if (target) {
      await page.mouse.click(target.x, target.y)
      return
    }
    await sleep(200)
  }

  throw new Error(`[web-e2e] Failed to click "${text}" via selector "${selector}" within ${timeoutMs}ms.`)
}

async function countElements(page: Page, selector: string) {
  return await page.evaluate((selector) => {
    const countMatches = (root: ParentNode): number => {
      let total = root.querySelectorAll(selector).length
      const hosts = Array.from(root.querySelectorAll('*')) as HTMLElement[]
      for (const host of hosts) {
        if (host.shadowRoot) {
          total += countMatches(host.shadowRoot)
        }
      }
      return total
    }
    return countMatches(document)
  }, selector)
}

async function pageContainsText(page: Page, text: string) {
  return await page.evaluate((text) => {
    const collectText = (root: ParentNode): string => {
      let output = ''
      const elements = Array.from(root.querySelectorAll('*')) as HTMLElement[]
      for (const element of elements) {
        output += ` ${element.textContent ?? ''}`
        if (element.shadowRoot) {
          output += ` ${collectText(element.shadowRoot)}`
        }
      }
      return output
    }
    return collectText(document).includes(text)
  }, text)
}

async function expectPageContainsText(page: Page, text: string) {
  await expect.poll(() => pageContainsText(page, text), { timeout: 20_000 }).toBe(true)
}

async function pageContainsVisibleText(page: Page, selector: string, text: string) {
  return await page.evaluate(({ selector, text }) => {
    const collectMatches = (root: ParentNode): HTMLElement[] => {
      const matches = Array.from(root.querySelectorAll(selector))
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
      const hosts = Array.from(root.querySelectorAll('*')) as HTMLElement[]
      for (const host of hosts) {
        if (host.shadowRoot) {
          matches.push(...collectMatches(host.shadowRoot))
        }
      }
      return matches
    }

    const isVisible = (element: HTMLElement) => {
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.display === 'none') {
        return false
      }
      if (element.hidden || element.hasAttribute('hidden')) {
        return false
      }
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }

    return collectMatches(document)
      .some(element => isVisible(element) && (element.textContent ?? '').includes(text))
  }, { selector, text })
}

async function expectVisibleElementText(page: Page, selector: string, text: string) {
  await expect.poll(() => pageContainsVisibleText(page, selector, text), { timeout: 20_000 }).toBe(true)
}

interface NavigationBarState {
  exists: boolean
  title: string | null
  frontColor: string | null
  backgroundColor: string | null
  loading: string | null
  loadingVisible: boolean
}

async function getNavigationBarState(page: Page): Promise<NavigationBarState> {
  return await page.evaluate(() => {
    const collectMatches = (root: ParentNode, selector: string): Element[] => {
      const matches = Array.from(root.querySelectorAll(selector))
      const hosts = Array.from(root.querySelectorAll('*')) as HTMLElement[]
      for (const host of hosts) {
        if (host.shadowRoot) {
          matches.push(...collectMatches(host.shadowRoot, selector))
        }
      }
      return matches
    }

    const nav = collectMatches(document, 'weapp-navigation-bar')[0] as HTMLElement | undefined
    if (!nav) {
      return {
        exists: false,
        title: null,
        frontColor: null,
        backgroundColor: null,
        loading: null,
        loadingVisible: false,
      }
    }
    const loading = nav.shadowRoot?.querySelector('.weapp-nav__loading')
    return {
      exists: true,
      title: nav.getAttribute('title'),
      frontColor: nav.getAttribute('front-color'),
      backgroundColor: nav.getAttribute('background-color'),
      loading: nav.getAttribute('loading'),
      loadingVisible: Boolean(loading && !loading.hasAttribute('hidden')),
    }
  })
}

interface ToastState {
  exists: boolean
  hidden: boolean
  text: string
}

async function getToastState(page: Page): Promise<ToastState> {
  return await page.evaluate(() => {
    const toast = document.querySelector('#__weapp_vite_web_toast__') as HTMLElement | null
    if (!toast) {
      return {
        exists: false,
        hidden: true,
        text: '',
      }
    }
    return {
      exists: true,
      hidden: toast.hasAttribute('hidden'),
      text: toast.textContent ?? '',
    }
  })
}

interface LoadingState {
  exists: boolean
  hidden: boolean
  text: string
}

async function getLoadingState(page: Page): Promise<LoadingState> {
  return await page.evaluate(() => {
    const loading = document.querySelector('#__weapp_vite_web_loading__') as HTMLElement | null
    if (!loading) {
      return {
        exists: false,
        hidden: true,
        text: '',
      }
    }
    return {
      exists: true,
      hidden: loading.hasAttribute('hidden'),
      text: loading.textContent ?? '',
    }
  })
}

async function openHomePage(page: Page) {
  await page.goto(WEB_URL, { waitUntil: 'domcontentloaded' })
  await expectVisibleElementText(page, '.hero-title', 'Hello World From weapp-vite!')
}

async function navigateToInteractiveFromHome(page: Page) {
  await page.evaluate(async () => {
    const wxRuntime = (window as any).wx
    if (!wxRuntime || typeof wxRuntime.navigateTo !== 'function') {
      throw new Error('[web-e2e] wx.navigateTo is unavailable in runtime')
    }
    await wxRuntime.navigateTo({
      url: 'pages/interactive/index?from=index',
    })
  })
  await expectVisibleElementText(page, '.lab__title', '互动场景实验室')
  await expectVisibleElementText(page, '.lab__meta', '来源：index')
}

describeWeb.sequential('web runtime browser baseline (weapp-vite-web-demo)', () => {
  let browser: Browser | undefined
  let devServer: ExecaChildProcess | undefined

  beforeAll(async () => {
    devServer = execa('node', [
      CLI_PATH,
      WEB_DEMO_ROOT,
      '--platform',
      'h5',
      '--host',
      WEB_HOST,
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        WEAPP_WEB_HOST: WEB_HOST,
        WEAPP_WEB_PORT: String(WEB_PORT),
        WEAPP_WEB_OPEN: 'false',
      },
    })

    const logsRef = createServerLogger(devServer)
    await waitForWebServerReady(devServer, logsRef)
    const launchOptions = PLAYWRIGHT_BUNDLED_AVAILABLE || !CHROMIUM_CHANNEL
      ? { headless: true }
      : { headless: true, channel: CHROMIUM_CHANNEL as Parameters<typeof chromium.launch>[0]['channel'] }
    browser = await chromium.launch(launchOptions)
  })

  afterAll(async () => {
    await browser?.close()
    await stopWebServer(devServer)
  })

  it('supports route navigation across index / interactive / detail pages', async () => {
    const page = await browser!.newPage()
    try {
      await openHomePage(page)
      await navigateToInteractiveFromHome(page)

      await findAndClickByText(page, BUTTON_LIKE_SELECTOR, '查看详情')
      await expectVisibleElementText(page, '.detail__title', '场景详情')
      await expectVisibleElementText(page, '.detail__meta', '来源：interactive')

      await findAndClickByText(page, BUTTON_LIKE_SELECTOR, '返回上一页')
      await expectVisibleElementText(page, '.lab__title', '互动场景实验室')

      await findAndClickByText(page, BUTTON_LIKE_SELECTOR, '返回')
      await expectVisibleElementText(page, '.hero-title', 'Hello World From weapp-vite!')
    }
    finally {
      await page.close()
    }
  })

  it('handles component triggerEvent flow in ScenarioPanel', async () => {
    const page = await browser!.newPage()
    try {
      await openHomePage(page)
      await navigateToInteractiveFromHome(page)

      await findAndClickByText(page, '.panel__item', 'dataset 传参')
      await expectVisibleElementText(page, '.lab__summary-body', 'bindtap + data-* 传参')
      await expectVisibleElementText(page, '.lab__log-title', '选择场景：dataset 传参')
    }
    finally {
      await page.close()
    }
  })

  it('updates view state through setData-driven rendering', async () => {
    const page = await browser!.newPage()
    try {
      await openHomePage(page)
      await navigateToInteractiveFromHome(page)

      await expect.poll(() => countElements(page, '.panel__item'), { timeout: 20_000 }).toBe(5)

      await findAndClickByText(page, '.filter-tag', '核心能力')
      await expect.poll(() => countElements(page, '.panel__item'), { timeout: 20_000 }).toBe(2)

      await findAndClickByText(page, '.action-chip', '显示/隐藏时间线')
      await expectPageContainsText(page, '时间线已隐藏，可通过动作按钮重新展示。')

      await findAndClickByText(page, '.action-chip', '显示/隐藏时间线')
      await expectPageContainsText(page, '生命周期 / 路由记录')
    }
    finally {
      await page.close()
    }
  })

  it('bridges navigation bar APIs to runtime component state', async () => {
    const page = await browser!.newPage()
    try {
      await openHomePage(page)
      await expect.poll(() => getNavigationBarState(page)).toMatchObject({
        exists: true,
        title: '初始模板',
      })

      await page.evaluate(async () => {
        const wxRuntime = (window as any).wx
        await wxRuntime.setNavigationBarTitle({ title: 'E2E 导航栏标题' })
        await wxRuntime.setNavigationBarColor({
          frontColor: '#ffffff',
          backgroundColor: '#123456',
          animation: { duration: 180, timingFunction: 'linear' },
        })
        await wxRuntime.showNavigationBarLoading()
      })

      await expect.poll(() => getNavigationBarState(page)).toMatchObject({
        title: 'E2E 导航栏标题',
        frontColor: '#ffffff',
        backgroundColor: '#123456',
        loading: 'true',
        loadingVisible: true,
      })

      await page.evaluate(async () => {
        await (window as any).wx.hideNavigationBarLoading()
      })

      await expect.poll(() => getNavigationBarState(page)).toMatchObject({
        loading: null,
        loadingVisible: false,
      })
    }
    finally {
      await page.close()
    }
  })

  it('bridges utility wx APIs for system info, loading, modal and toast', async () => {
    const page = await browser!.newPage()
    try {
      await openHomePage(page)
      const info = await page.evaluate(() => {
        return (window as any).wx.getSystemInfoSync()
      })
      expect(info).toMatchObject({
        brand: 'web',
      })
      expect(typeof info.windowWidth).toBe('number')
      expect(typeof info.windowHeight).toBe('number')
      expect(typeof info.pixelRatio).toBe('number')

      await page.evaluate(async () => {
        await (window as any).wx.showLoading({
          title: 'E2E Loading',
          mask: true,
        })
      })

      await expect.poll(() => getLoadingState(page)).toMatchObject({
        exists: true,
        hidden: false,
        text: expect.stringContaining('E2E Loading'),
      })

      await page.evaluate(async () => {
        await (window as any).wx.hideLoading()
      })
      await expect.poll(() => getLoadingState(page)).toMatchObject({
        hidden: true,
      })

      const modalResult = await page.evaluate(async () => {
        const originalConfirm = (window as any).confirm
        ;(window as any).confirm = () => false
        try {
          return await (window as any).wx.showModal({
            title: 'E2E Modal',
            content: '确认取消路径',
          })
        }
        finally {
          ;(window as any).confirm = originalConfirm
        }
      })
      expect(modalResult).toMatchObject({
        errMsg: 'showModal:ok',
        confirm: false,
        cancel: true,
      })

      await page.evaluate(async () => {
        await (window as any).wx.showToast({
          title: 'E2E Toast',
          icon: 'none',
          duration: 120,
        })
      })

      await expect.poll(() => getToastState(page)).toMatchObject({
        exists: true,
        hidden: false,
        text: expect.stringContaining('E2E Toast'),
      })

      await sleep(240)
      await expect.poll(() => getToastState(page)).toMatchObject({
        hidden: true,
      })
    }
    finally {
      await page.close()
    }
  })
})
