import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { build, preview } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '../..')
const WEB_ROOT = path.join(ROOT, 'packages-runtime/web')
let consumer: string
let browser: Browser

async function globals(page: Page) {
  return page.evaluate(() => {
    const host = globalThis as any
    return {
      wx: typeof host.wx,
      getApp: typeof host.getApp,
      getCurrentPages: typeof host.getCurrentPages,
    }
  })
}

async function closeServer(server: PreviewServer) {
  await new Promise<void>((resolve, reject) => {
    server.httpServer.close(error => error ? reject(error) : resolve())
  })
}

describe('issue #984: production package runtime initialization', () => {
  beforeAll(async () => {
    const temporaryRoot = path.join(ROOT, '.codex-tmp')
    await mkdir(temporaryRoot, { recursive: true })
    consumer = await mkdtemp(path.join(temporaryRoot, 'web-production-'))
    await cp(path.join(ROOT, 'e2e/fixtures/web-production'), consumer, { recursive: true })
    const installedPackage = path.join(consumer, 'node_modules/@weapp-vite/web')
    await mkdir(installedPackage, { recursive: true })
    // 只复制发布文件；包内依赖沿用安装结果，不让源码 alias 参与消费构建。
    await cp(path.join(WEB_ROOT, 'package.json'), path.join(installedPackage, 'package.json'))
    await cp(path.join(WEB_ROOT, 'dist'), path.join(installedPackage, 'dist'), { recursive: true })
    await symlink(path.join(WEB_ROOT, 'node_modules'), path.join(installedPackage, 'node_modules'), 'junction')
    await symlink(path.join(ROOT, 'packages-runtime/wevu'), path.join(consumer, 'node_modules/wevu'), 'junction')
    await symlink(path.join(WEB_ROOT, 'node_modules/lit'), path.join(consumer, 'node_modules/lit'), 'junction')
    browser = await chromium.launch()
  })

  afterAll(async () => {
    await browser?.close()
    if (consumer) {
      await rm(consumer, { recursive: true, force: true })
    }
  })

  it.each([false, true] as const)('retains globals and navigation with minify=%s', async (minify) => {
    const modules: string[] = []
    await build({
      root: consumer,
      configFile: false,
      mode: 'production',
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      plugins: [{
        name: 'verify-package-consumption',
        moduleParsed(module) {
          modules.push(module.id.replaceAll('\\', '/'))
        },
      }],
      build: {
        minify,
        rolldownOptions: {
          input: ['index', 'side-effect', 'polyfill'].map(name => path.join(consumer, `${name}.html`)),
        },
      },
    })
    expect(modules.some(id => id.endsWith('/node_modules/@weapp-vite/web/dist/runtime/index.mjs'))).toBe(true)
    expect(modules.some(id => id.includes('/packages-runtime/web/src/'))).toBe(false)
    const server = await preview({ root: consumer, configFile: false, preview: { host: '127.0.0.1', port: 0, open: false } })
    const page = await browser.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      const origin = server.resolvedUrls.local[0]!
      for (const entry of ['side-effect', 'polyfill']) {
        await page.goto(`${origin}${entry}.html`)
        expect(await globals(page)).toEqual({ wx: 'object', getApp: 'function', getCurrentPages: 'function' })
      }
      for (const target of ['native', 'router']) {
        await page.goto(origin)
        expect(await globals(page)).toEqual({ wx: 'object', getApp: 'function', getCurrentPages: 'function' })
        await expect.poll(() => page.getByText('production-home', { exact: true }).isVisible()).toBe(true)
        expect(await page.evaluate(() => (globalThis as any).getApp().globalData.marker)).toBe('production-app')
        await page.locator(`#${target}`).click()
        await expect.poll(() => page.evaluate(() => (globalThis as any).getCurrentPages().map((item: any) => item.route))).toEqual([
          'pages/home/index',
          `pages/${target}/index`,
        ])
        await expect.poll(() => page.getByText(`production-${target}`, { exact: true }).isVisible()).toBe(true)
      }
      expect(errors).toEqual([])
    }
    catch (error) {
      throw new Error(`${String(error)}\nBrowser errors: ${errors.join('\n')}\nDOM: ${await page.locator('body').innerHTML()}`, { cause: error })
    }
    finally {
      await page.close()
      await closeServer(server)
    }
  })
})
