/* eslint-disable e18e/ban-dependencies -- Web 视觉 E2E 需要 execa 管理长驻 dev server。 */
import type { Subprocess } from 'execa'
import type { Browser, Page } from 'playwright'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { execa } from 'execa'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { comparePngWithBaseline } from '../../packages/weapp-ide-cli/src/cli/imageDiff'

const ROOT = path.resolve(import.meta.dirname, '../..')
const WEB_DEMO_ROOT = path.join(ROOT, 'apps/weapp-vite-web-demo')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const BASELINE_ROOT = path.join(ROOT, 'e2e/web-runtime/baselines/weapp')
const OUTPUT_ROOT = path.join(ROOT, '.tmp/web-runtime-visual')
const WEB_HOST = '127.0.0.1'
const WEB_PORT = Number(process.env.WEAPP_VITE_WEB_VISUAL_E2E_PORT ?? 5181)
const WEB_URL = `http://${WEB_HOST}:${WEB_PORT}`

interface VisualCase {
  id: string
  route: string
  baseline: string
  threshold: number
  maxDiffRatio: number
}

interface VisualManifest {
  version: number
  device: {
    windowWidth: number
    windowHeight: number
    pixelRatio: number
    screenshotScale: number
    safeAreaInsetBottom: number
  }
  cases: VisualCase[]
}

const PLAYWRIGHT_EXECUTABLE = chromium.executablePath()
const CHROMIUM_CHANNEL = process.env.WEAPP_VITE_WEB_E2E_CHANNEL
const PLAYWRIGHT_BUNDLED_AVAILABLE = existsSync(PLAYWRIGHT_EXECUTABLE)
const BROWSER_AVAILABLE = PLAYWRIGHT_BUNDLED_AVAILABLE || Boolean(CHROMIUM_CHANNEL)
const describeWeb = BROWSER_AVAILABLE ? describe : describe.skip

function parseVisualManifest(value: unknown): VisualManifest {
  if (!value || typeof value !== 'object') {
    throw new TypeError('[web-visual] baseline manifest 必须是对象')
  }
  const manifest = value as Record<string, unknown>
  const device = manifest.device as Record<string, unknown> | undefined
  const cases = manifest.cases
  if (
    manifest.version !== 1
    || !device
    || !Number.isFinite(device.windowWidth)
    || !Number.isFinite(device.windowHeight)
    || !Number.isFinite(device.pixelRatio)
    || !Number.isFinite(device.screenshotScale)
    || !Number.isFinite(device.safeAreaInsetBottom)
    || !Array.isArray(cases)
  ) {
    throw new TypeError('[web-visual] baseline manifest 字段无效')
  }
  return manifest as unknown as VisualManifest
}

async function readVisualManifest() {
  const source = await fs.readFile(path.join(BASELINE_ROOT, 'manifest.json'), 'utf8')
  return parseVisualManifest(JSON.parse(source) as unknown)
}

async function waitForWebServerReady(server: Subprocess, logs: { value: string }, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (server.nodeChildProcess.exitCode !== null) {
      throw new Error(`[web-visual] dev server exited early\n${logs.value}`)
    }
    try {
      const response = await fetch(WEB_URL)
      if (response.ok) {
        return
      }
    }
    catch {}
    await sleep(300)
  }
  throw new Error(`[web-visual] timeout waiting for ${WEB_URL}\n${logs.value}`)
}

async function stopWebServer(server?: Subprocess) {
  if (!server || server.nodeChildProcess.exitCode !== null) {
    return
  }
  server.kill('SIGTERM')
  const forceKillTimer = setTimeout(() => {
    if (server?.nodeChildProcess.exitCode === null) {
      server.kill('SIGKILL')
    }
  }, 5_000)
  try {
    await server
  }
  catch {}
  finally {
    clearTimeout(forceKillTimer)
  }
}

async function navigateToVisualCase(page: Page, route: string) {
  await page.goto(WEB_URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async (url) => {
    await (window as any).wx.reLaunch({ url })
  }, route)
  const routeId = route.replace(/^\//, '').split('?')[0]!
  await expect.poll(async () => {
    return await page.evaluate((id) => {
      return Boolean(document.querySelector(`[data-weapp-page="${id}"]`))
    }, routeId)
  }, { timeout: 45_000 }).toBe(true)
  await page.evaluate(async () => {
    await document.fonts?.ready
    const collectImages = (root: ParentNode): HTMLImageElement[] => {
      const images = [...root.querySelectorAll('img')] as HTMLImageElement[]
      for (const element of [...root.querySelectorAll('*')]) {
        if (element.shadowRoot) {
          images.push(...collectImages(element.shadowRoot))
        }
      }
      return images
    }
    const images = collectImages(document)
    await Promise.all(images.map(image => image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener('error', () => resolve(), { once: true })
        })))
  })
  await sleep(150)
}

async function hideWebNavigationBar(page: Page) {
  await page.evaluate(() => {
    const hideNavigationBar = (root: ParentNode): boolean => {
      const navigationBar = root.querySelector('weapp-navigation-bar') as HTMLElement | null
      if (navigationBar) {
        navigationBar.style.display = 'none'
        return true
      }
      for (const element of [...root.querySelectorAll('*')]) {
        if (element.shadowRoot && hideNavigationBar(element.shadowRoot)) {
          return true
        }
      }
      return false
    }
    hideNavigationBar(document)
  })
}

describeWeb.sequential('web runtime visual parity', () => {
  let browser: Browser | undefined
  let devServer: Subprocess | undefined
  let manifest: VisualManifest

  beforeAll(async () => {
    manifest = await readVisualManifest()
    await fs.rm(OUTPUT_ROOT, { recursive: true, force: true })
    await fs.mkdir(OUTPUT_ROOT, { recursive: true })
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
    const logs = { value: '' }
    devServer.stdout?.on('data', chunk => logs.value += String(chunk))
    devServer.stderr?.on('data', chunk => logs.value += String(chunk))
    await waitForWebServerReady(devServer, logs)
    const launchOptions = PLAYWRIGHT_BUNDLED_AVAILABLE || !CHROMIUM_CHANNEL
      ? { headless: true }
      : { headless: true, channel: CHROMIUM_CHANNEL as Parameters<typeof chromium.launch>[0]['channel'] }
    browser = await chromium.launch(launchOptions)
  })

  afterAll(async () => {
    await browser?.close()
    await stopWebServer(devServer)
  })

  it('matches committed WeChat DevTools baselines', async () => {
    const comparisons: Array<{
      id: string
      diffRatio: number
      maxDiffRatio: number
    }> = []
    for (const visualCase of manifest.cases) {
      const context = await browser!.newContext({
        viewport: {
          width: manifest.device.windowWidth,
          height: manifest.device.windowHeight,
        },
        deviceScaleFactor: manifest.device.screenshotScale,
      })
      const page = await context.newPage()
      try {
        await navigateToVisualCase(page, visualCase.route)
        await page.evaluate((safeAreaInsetBottom) => {
          document.documentElement.style.setProperty(
            '--weapp-safe-area-inset-bottom',
            `${safeAreaInsetBottom}px`,
          )
        }, manifest.device.safeAreaInsetBottom)
        await hideWebNavigationBar(page)
        const current = await page.screenshot({ animations: 'disabled' })
        const currentPath = path.join(OUTPUT_ROOT, `${visualCase.id}.current.png`)
        const diffPath = path.join(OUTPUT_ROOT, `${visualCase.id}.diff.png`)
        await fs.writeFile(currentPath, current)
        const result = await comparePngWithBaseline({
          baselinePath: path.join(BASELINE_ROOT, visualCase.baseline),
          currentPngBuffer: current,
          diffOutputPath: diffPath,
          threshold: visualCase.threshold,
        })
        comparisons.push({
          id: visualCase.id,
          diffRatio: result.diffRatio,
          maxDiffRatio: visualCase.maxDiffRatio,
        })
      }
      finally {
        await context.close()
      }
    }
    for (const comparison of comparisons) {
      expect(comparison.diffRatio, `${comparison.id} diff ratio`).toBeLessThanOrEqual(comparison.maxDiffRatio)
    }
  })

  it('keeps the mini-program viewport centered and fixed content bounded on desktop', async () => {
    const page = await browser!.newPage({ viewport: { width: 1200, height: 900 } })
    try {
      await navigateToVisualCase(page, '/pages/visual-parity/index')
      const layout = await page.evaluate(() => {
        const app = document.querySelector('#app') as HTMLElement
        const footer = document.querySelector('wv-page-pages-visual-parity-index')
          ?.shadowRoot
          ?.querySelector('.matrix__footer') as HTMLElement
        const appRect = app.getBoundingClientRect()
        const footerRect = footer.getBoundingClientRect()
        return {
          app: { left: appRect.left, right: appRect.right, width: appRect.width },
          footer: { left: footerRect.left, right: footerRect.right },
          rpx: getComputedStyle(document.documentElement).getPropertyValue('--rpx').trim(),
        }
      })
      expect(layout.app.width).toBe(375)
      expect(layout.app.left).toBe((1200 - 375) / 2)
      expect(layout.footer.left).toBeGreaterThanOrEqual(layout.app.left)
      expect(layout.footer.right).toBeLessThanOrEqual(layout.app.right)
      expect(layout.rpx).toBe('0.5px')
    }
    finally {
      await page.close()
    }
  })

  it('emits input and scroll events with mini-program detail data', async () => {
    const page = await browser!.newPage({ viewport: { width: 375, height: 812 } })
    try {
      await navigateToVisualCase(page, '/pages/visual-parity/index')
      const input = page.locator('weapp-input input').first()
      await input.fill('runtime')
      await expect.poll(async () => {
        return await page.evaluate(() => (window as any).getCurrentPages().at(-1)?.data.inputEvent)
      }).toBe('input: runtime')

      await page.locator('weapp-scroll-view .viewport').first().evaluate((element) => {
        element.scrollLeft = 80
        element.dispatchEvent(new Event('scroll'))
      })
      await expect.poll(async () => {
        return await page.evaluate(() => (window as any).getCurrentPages().at(-1)?.data.scrollEvent)
      }).toBe('80, 0')
    }
    finally {
      await page.close()
    }
  })

  it('submits and resets native form controls with mini-program detail data', async () => {
    const page = await browser!.newPage({ viewport: { width: 390, height: 753 } })
    try {
      await navigateToVisualCase(page, '/pages/form-parity/index')

      await page.locator('weapp-label[for="profile-name"]').click()
      await expect.poll(async () => {
        return await page.locator('weapp-input#profile-name input').evaluate((element) => {
          const root = element.getRootNode()
          return root instanceof ShadowRoot && root.activeElement === element
        })
      }).toBe(true)

      await page.locator('weapp-input#profile-name input').fill('Grace')
      await page.locator('weapp-textarea textarea').fill('Shipping the web runtime')
      await page.getByText('Compiler', { exact: true }).click()
      await page.getByText('Preview', { exact: true }).click()
      await page.locator('.switch-row__title').click()
      await page.getByText('提交资料', { exact: true }).click()

      await expect.poll(async () => {
        return await page.evaluate(() => {
          const data = (window as any).getCurrentPages().at(-1)?.data
          if (data?.resultState !== 'submitted') {
            return { state: data?.resultState, value: null }
          }
          return {
            state: data?.resultState,
            value: JSON.parse(data.resultSummary),
          }
        })
      }).toEqual({
        state: 'submitted',
        value: {
          profileName: 'Grace',
          bio: 'Shipping the web runtime',
          skills: ['runtime', 'compiler'],
          channel: 'preview',
          notify: false,
        },
      })

      await page.getByText('重置', { exact: true }).click()
      await expect.poll(async () => {
        return await page.evaluate(() => (window as any).getCurrentPages().at(-1)?.data)
      }).toMatchObject({
        profileName: 'Ada',
        bio: 'Building mini-program tooling',
        runtimeChecked: true,
        compilerChecked: false,
        channel: 'stable',
        notify: true,
        resultState: 'reset',
      })
      await expect.poll(() => page.locator('weapp-input#profile-name input').inputValue()).toBe('Ada')
      await expect.poll(() => page.locator('weapp-textarea textarea').inputValue()).toBe('Building mini-program tooling')
    }
    finally {
      await page.close()
    }
  })

  it('updates picker, picker-view and slider values with mini-program detail data', async () => {
    const page = await browser!.newPage({ viewport: { width: 390, height: 753 } })
    try {
      await navigateToVisualCase(page, '/pages/selection-parity/index')

      const pickerViewState = await page.locator('weapp-picker-view-column').evaluateAll((columns) => {
        return columns.map((column: any) => ({
          count: column.itemCount,
          index: column.selectedIndex,
        }))
      })
      expect(pickerViewState).toEqual([
        { count: 3, index: 1 },
        { count: 3, index: 2 },
        { count: 3, index: 1 },
      ])

      await page.locator('weapp-picker').first().evaluate((element: any) => element.open())
      await page.locator('weapp-picker select').first().selectOption('2')
      await page.locator('weapp-picker .toolbar button').nth(1).click()
      await expect.poll(async () => {
        return await page.evaluate(() => (window as any).getCurrentPages().at(-1)?.data)
      }).toMatchObject({
        environmentIndex: 2,
        environmentLabel: '真机预览',
        eventSummary: 'picker:environment=2',
      })

      await page.locator('weapp-picker').first().evaluate((element: any) => element.open())
      await page.locator('weapp-picker .backdrop').first().click({ position: { x: 4, y: 4 } })
      await expect.poll(async () => {
        return await page.locator('weapp-picker .backdrop').first().evaluate((element: HTMLElement) => ({
          hidden: element.hidden,
          summary: (window as any).getCurrentPages().at(-1)?.data?.eventSummary,
        }))
      }).toEqual({ hidden: true, summary: 'picker:cancel' })

      await page.locator('weapp-picker-view-column').first().evaluate(async (column: any) => {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        const scroller = column.shadowRoot?.querySelector('.scroller') as HTMLElement
        scroller.scrollTop = 0
        scroller.dispatchEvent(new Event('scroll'))
      })
      await expect.poll(async () => {
        return await page.evaluate(() => (window as any).getCurrentPages().at(-1)?.data)
      }).toMatchObject({
        pickerViewValue: [0, 2, 1],
        pickerViewLabel: '小程序 / TypeScript / 生产',
        eventSummary: 'picker-view=0,2,1',
      })

      await page.locator('weapp-slider input').first().evaluate((input: HTMLInputElement) => {
        input.value = '74'
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })
      await expect.poll(async () => {
        return await page.evaluate(() => (window as any).getCurrentPages().at(-1)?.data)
      }).toMatchObject({
        sliderValue: 74,
        eventSummary: 'slider=74',
      })
    }
    finally {
      await page.close()
    }
  })

  it('navigates declaratively and updates swiper state from controls, touch and autoplay', async () => {
    const page = await browser!.newPage({ viewport: { width: 390, height: 753 } })
    try {
      await navigateToVisualCase(page, '/pages/navigation-parity/index')

      await page.locator('weapp-navigator').click()
      await expect.poll(async () => {
        return await page.evaluate(() => {
          const currentPage = (window as any).getCurrentPages().at(-1)
          return { route: currentPage?.route, from: currentPage?.data?.from }
        })
      }).toEqual({
        route: 'pages/about/index',
        from: 'navigation-parity',
      })

      await page.evaluate(async () => await (window as any).wx.navigateBack())
      await expect.poll(async () => {
        return await page.evaluate(() => (window as any).getCurrentPages().at(-1)?.route)
      }).toBe('pages/navigation-parity/index')

      await page.getByText('下一项', { exact: true }).click()
      await expect.poll(async () => {
        return await page.evaluate(() => (window as any).getCurrentPages().at(-1)?.data)
      }).toMatchObject({ current: 2, eventSource: 'programmatic' })

      const viewport = page.locator('weapp-swiper .viewport')
      const box = await viewport.boundingBox()
      if (!box) {
        throw new TypeError('[web-visual] swiper viewport is not visible')
      }
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 })
      await page.mouse.up()
      await expect.poll(async () => {
        return await page.evaluate(() => (window as any).getCurrentPages().at(-1)?.data)
      }).toMatchObject({ current: 0, eventSource: 'touch' })

      await page.locator('weapp-swiper').evaluate((element) => {
        element.setAttribute('duration', '0')
        element.setAttribute('interval', '40')
        element.setAttribute('autoplay', 'true')
      })
      await expect.poll(async () => {
        return await page.evaluate(() => (window as any).getCurrentPages().at(-1)?.data?.eventSource)
      }).toBe('autoplay')

      const autoplayLifecycle = await page.locator('weapp-swiper').evaluate(async (element) => {
        const parent = element.parentNode
        const nextSibling = element.nextSibling
        if (!parent) {
          throw new TypeError('[web-visual] swiper parent is unavailable')
        }
        const readCurrent = () => (window as any).getCurrentPages().at(-1)?.data?.current as number
        element.remove()
        const disconnectedCurrent = readCurrent()
        await new Promise(resolve => setTimeout(resolve, 120))
        const afterDisconnect = readCurrent()
        const controlledCurrent = (afterDisconnect + 1) % 3
        element.setAttribute('current', String(controlledCurrent))
        parent.insertBefore(element, nextSibling)
        const activeAfterReconnect = [...element.querySelectorAll('weapp-swiper-item')]
          .findIndex(item => item.hasAttribute('data-active'))
        const deadline = Date.now() + 500
        while (readCurrent() === afterDisconnect && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 20))
        }
        return {
          disconnectedCurrent,
          afterDisconnect,
          controlledCurrent,
          activeAfterReconnect,
          afterReconnect: readCurrent(),
        }
      })
      expect(autoplayLifecycle.afterDisconnect).toBe(autoplayLifecycle.disconnectedCurrent)
      expect(autoplayLifecycle.activeAfterReconnect).toBe(autoplayLifecycle.controlledCurrent)
      expect(autoplayLifecycle.afterReconnect).not.toBe(autoplayLifecycle.afterDisconnect)
      await page.locator('weapp-swiper').evaluate(element => element.removeAttribute('autoplay'))
    }
    finally {
      await page.close()
    }
  })
})
