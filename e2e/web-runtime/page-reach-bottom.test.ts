import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { build, preview } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '../..')
const WEB_ROOT = path.join(ROOT, 'packages-runtime/web')
const ACTIVE = '[data-weapp-page-active="true"]'

interface FixturePage {
  route: string
  _appendRows: () => Promise<void>
  _setContentHeight: (height: number) => void
}

interface FixtureHost {
  getCurrentPages: () => FixturePage[]
  wx: {
    reLaunch: (options: { url: string }) => Promise<unknown>
    navigateTo: (options: { url: string }) => Promise<unknown>
    navigateBack: () => Promise<unknown>
    pageScrollTo: (options: { scrollTop: number, duration: number }) => Promise<unknown>
  }
}

async function metrics(page: Page) {
  return page.locator('#app').evaluate(element => ({
    top: element.scrollTop,
    height: element.scrollHeight,
    client: element.clientHeight,
  }))
}

async function count(page: Page) {
  return Number(await page.locator(`${ACTIVE} #count`).textContent())
}

async function scrollToBottom(page: Page) {
  await page.locator('#app').evaluate((element) => {
    element.scrollTop = element.scrollHeight - element.clientHeight
  })
}

async function finishScrollFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

// 从独立发布包的公开 plugin 入口编译 WXML，再将真实 render 产物打包给 Chromium。
// 原生与 wevu hook 共用这份编译结果，由浏览器真实滚动派发，不手写 Lit 渲染函数。
// 无需启动微信 IDE；整个 suite 仍经 Web E2E 配置取得机器串行租约。
describe('page reach-bottom pagination in the published Web runtime', { concurrent: false }, () => {
  let project: string
  let browser: Browser | undefined
  let server: PreviewServer | undefined
  let page: Page
  let errors: string[]

  beforeAll(async () => {
    const temporaryRoot = path.join(ROOT, '.codex-tmp')
    await mkdir(temporaryRoot, { recursive: true })
    project = await mkdtemp(path.join(temporaryRoot, 'page-reach-bottom-'))
    await cp(path.join(ROOT, 'e2e/fixtures/page-reach-bottom'), project, { recursive: true })
    const installedPackage = path.join(project, 'node_modules/@weapp-vite/web')
    await mkdir(installedPackage, { recursive: true })
    await cp(path.join(WEB_ROOT, 'package.json'), path.join(installedPackage, 'package.json'))
    await cp(path.join(WEB_ROOT, 'dist'), path.join(installedPackage, 'dist'), { recursive: true })
    await symlink(path.join(WEB_ROOT, 'node_modules'), path.join(installedPackage, 'node_modules'), 'junction')
    await symlink(path.join(ROOT, 'packages-runtime/wevu'), path.join(project, 'node_modules/wevu'), 'junction')
    await symlink(path.join(WEB_ROOT, 'node_modules/lit'), path.join(project, 'node_modules/lit'), 'junction')
    const { weappWebPlugin } = await import(pathToFileURL(path.join(installedPackage, 'dist/plugin.mjs')).href) as typeof import('@weapp-vite/web/plugin')
    const modules: string[] = []
    const templates = new Map<string, string[]>()
    await build({
      root: project,
      configFile: false,
      mode: 'production',
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      plugins: [weappWebPlugin({ srcDir: 'templates' }), {
        name: 'verify-published-reach-bottom-runtime',
        moduleParsed(module) {
          modules.push(module.id.replaceAll('\\', '/'))
          if (module.id.includes('.wxml?weapp-web-template')) {
            templates.set(path.basename(module.id.split('?')[0]!), module.exports)
          }
        },
      }],
      build: { minify: true },
    })
    expect(modules.some(id => id.endsWith('/node_modules/@weapp-vite/web/dist/runtime/index.mjs'))).toBe(true)
    expect(modules.some(id => id.includes('/packages-runtime/web/src/'))).toBe(false)
    expect(templates.size).toBe(2)
    expect(templates.get('page.wxml')).toContain('render')
    expect(templates.get('peer.wxml')).toContain('render')
    server = await preview({ root: project, configFile: false, preview: { host: '127.0.0.1', port: 0, open: false } })
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  beforeEach(async () => {
    page = await browser!.newPage({ viewport: { width: 800, height: 500 } })
    errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(server!.resolvedUrls!.local[0]!)
  })

  afterEach(async () => {
    try {
      expect(errors).toEqual([])
    }
    finally {
      await page?.close()
    }
  })

  afterAll(async () => {
    try {
      await browser?.close()
    }
    finally {
      if (server) {
        await new Promise<void>((resolve, reject) => server!.httpServer.close(error => error ? reject(error) : resolve()))
      }
      if (project) {
        await rm(project, { recursive: true, force: true })
      }
    }
  })

  async function open(kind: string) {
    const route = `pages/${kind}/index`
    await page.evaluate(async (route) => {
      const host = globalThis as unknown as FixtureHost
      await host.wx.reLaunch({ url: `/${route}` })
    }, route)
    await expect.poll(() => page.locator(ACTIVE).getAttribute('data-weapp-page')).toBe(route)
    await expect.poll(() => count(page)).toBe(0)
    await expect.poll(async () => (await metrics(page)).height).toBe(1200)
  }

  for (const kind of ['native', 'wevu']) {
    it(`${kind}: loads the next page after asynchronous content growth and one scroll`, async () => {
      await open(kind)
      await scrollToBottom(page)
      await expect.poll(() => count(page)).toBe(1)
      const before = await metrics(page)
      await page.evaluate(async () => {
        await (globalThis as unknown as FixtureHost).getCurrentPages().at(-1)!._appendRows()
      })
      await expect.poll(() => metrics(page)).toEqual({ ...before, height: before.height + 100 })
      expect(await count(page)).toBe(1)
      await scrollToBottom(page)
      await expect.poll(() => count(page)).toBe(2)
      await page.locator('#app').evaluate(element => element.scrollTop -= 1)
      await finishScrollFrame(page)
      await scrollToBottom(page)
      await finishScrollFrame(page)
      expect(await count(page)).toBe(2)
      const events = (await page.locator(`${ACTIVE} #events`).textContent())!.split(',')
      expect(events.filter(event => event === 'bottom')).toHaveLength(2)
      expect(events.every((event, index) => event !== 'bottom' || events[index - 1] === 'scroll')).toBe(true)
    })

    it(`${kind}: restores a retained bottom position without a new callback`, async () => {
      await open(kind)
      await scrollToBottom(page)
      await expect.poll(() => count(page)).toBe(1)
      const before = await metrics(page)
      await page.evaluate(async () => {
        const host = globalThis as unknown as FixtureHost
        await host.wx.navigateTo({ url: '/pages/peer/index' })
      })
      await page.locator(`${ACTIVE} #peer`).waitFor()
      await page.evaluate(async () => (globalThis as unknown as FixtureHost).wx.navigateBack())
      await expect.poll(() => metrics(page)).toEqual(before)
      await finishScrollFrame(page)
      expect(await count(page)).toBe(1)
      await page.evaluate(async () => {
        const host = globalThis as unknown as FixtureHost
        await host.wx.pageScrollTo({ scrollTop: 0, duration: 0 })
      })
      await finishScrollFrame(page)
      await page.evaluate(async () => {
        const host = globalThis as unknown as FixtureHost
        await host.wx.pageScrollTo({ scrollTop: document.querySelector('#app')!.scrollHeight, duration: 0 })
      })
      await expect.poll(() => count(page)).toBe(2)
      await finishScrollFrame(page)
      expect(await count(page)).toBe(2)
    })

    it(`${kind}: stays idle when content does not fill the viewport`, async () => {
      await open(kind)
      await page.evaluate(() => (globalThis as unknown as FixtureHost).getCurrentPages().at(-1)!._setContentHeight(200))
      await expect.poll(async () => {
        const value = await metrics(page)
        return value.height === value.client
      }).toBe(true)
      await page.evaluate(async () => {
        await (globalThis as unknown as FixtureHost).wx.pageScrollTo({ scrollTop: 1000, duration: 0 })
      })
      await finishScrollFrame(page)
      expect(await count(page)).toBe(0)
    })
  }
})
