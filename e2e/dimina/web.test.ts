/* eslint-disable e18e/ban-dependencies -- 使用跨平台子进程编译真实产物。 */
import type { Browser, Page } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cacheRoot, repositoryRoot, root } from '../../packages-private/dimina-playground/config'
import { content, startHost, stopHost, visible } from './helpers'

for (const mode of ['preview', 'dev'] as const) {
  describe(`Dimina ${mode}`, () => {
    let browser: Browser
    let host: Awaited<ReturnType<typeof startHost>>
    beforeAll(async () => {
      browser = await chromium.launch({ channel: process.env.WEAPP_VITE_E2E_CHANNEL })
      if (mode === 'preview') {
        await execa('pnpm', ['--filter', '@weapp-vite/dimina-playground', 'build'], { cwd: repositoryRoot })
      }
      host = await startHost(mode)
    })
    afterAll(async () => {
      await browser?.close()
      await stopHost(host?.process)
    })

    async function withPage(example: string, run: (page: Page) => Promise<void>) {
      const page = await browser.newPage({ viewport: { width: 900, height: 1000 } })
      page.setDefaultTimeout(15_000)
      const errors: string[] = []
      const consoleErrors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text())
        }
      })
      page.on('pageerror', error => errors.push(error.stack || error.message || String(error)))
      try {
        await page.goto(`${host.url}?example=${example}`)
        await run(page)
        expect(errors).toEqual([])
      }
      catch (error) {
        const frames = await Promise.all(page.frames().map(async frame => ({
          url: frame.url(),
          text: (await frame.locator('body').textContent().catch(() => '') ?? '').replace(/\s+/g, ' ').slice(0, 2000),
        })))
        // eslint-disable-next-line no-console -- 保留真实 iframe 的失败诊断，不把主线程当作小程序 runtime。
        console.error({ example, mode, errors, consoleErrors, frames, hostLogs: host.logs().slice(-6000) })
        throw error
      }
      finally {
        const screenshots = path.join(cacheRoot, 'screenshots')
        await mkdir(screenshots, { recursive: true })
        const name = (expect.getState().currentTestName ?? example).replace(/[^\w-]+/g, '-')
        await page.screenshot({ path: path.join(screenshots, `${name}.png`), fullPage: true }).catch(() => undefined)
        await page.close()
      }
    }

    it('runs native components, WXS, npm, subpackages and the host Bridge', async () => {
      await withPage('native', async (page) => {
        await visible(page, '原生计数：0')
        await content(page).getByText('原生加一', { exact: true }).click()
        await visible(page, '原生计数：1')
        await visible(page, 'WXS：2')
        await content(page).getByText('触发组件事件', { exact: true }).click()
        await visible(page, '组件事件：1')
        await content(page).getByText('npm 加一', { exact: true }).click()
        await visible(page, '原生计数：2')
        await expect.poll(() => content(page).locator('img').evaluateAll(images => images.some(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth === 32))).toBe(true)
        await content(page).getByText('调用宿主', { exact: true }).click()
        await visible(page, '宿主调用成功')
        await content(page).getByText('宿主失败', { exact: true }).click()
        await visible(page, 'Playground: unsupported event')
        await content(page).getByText('进入分包', { exact: true }).click()
        await visible(page, '分包详情')
        // SDK 页面内容会早于转场结束出现；等待公开 DOM 转场结束后再返回。
        await expect.poll(() => page.locator('.dimina-native-view--enter-anima').count()).toBe(0)
        await content(page).getByText('返回首页', { exact: true }).click()
        await visible(page, '原生计数：2')
      })
    })

    it('resolves subpackage generic bindings and defaults, and updates empty/multiple virtual roots', async () => {
      await withPage('native', async (page) => {
        await visible(page, '原生计数：0')
        await content(page).getByText('进入分包', { exact: true }).click()
        await visible(page, '分包泛型：1')
        await visible(page, '分包默认：1')
        await content(page).getByText('更新分包属性', { exact: true }).click()
        await visible(page, '分包泛型：2')
        await visible(page, '分包默认：2')
        await content(page).getByText('选择分包泛型', { exact: true }).click()
        await visible(page, '分包事件：sub:2')
        for (const count of [1, 2, 0, 1]) {
          await content(page).getByText('切换动态根', { exact: true }).click()
          await expect.poll(() => content(page).locator('.dynamic-root').count()).toBe(count)
          for (const element of await content(page).locator('.dynamic-root').all()) {
            expect(await element.evaluate(node => node.parentElement?.hasAttribute('data-dd-component-host'))).toBe(false)
            expect(await element.evaluate(node => getComputedStyle(node).color)).toBe('rgb(18, 52, 86)')
          }
        }
        expect(await content(page).locator('[name="/components/dynamic-roots/index"]').count()).toBe(0)
        await expect.poll(() => page.locator('.dimina-native-view--enter-anima').count()).toBe(0)
        await content(page).getByText('返回首页', { exact: true }).click()
        await visible(page, '原生计数：0')
        await content(page).getByText('进入分包', { exact: true }).click()
        await visible(page, '分包泛型：1')
        await expect.poll(() => content(page).locator('.dynamic-root').count()).toBe(0)
        await expect.poll(() => page.locator('.dimina-native-view--enter-anima').count()).toBe(0)
      })
    })

    it('runs wevu reactivity and v-model', async () => {
      await withPage('wevu', async (page) => {
        await visible(page, 'wevu 计数：0')
        await content(page).getByText('wevu 加一', { exact: true }).click()
        await visible(page, 'wevu 计数：1')
        await content(page).locator('input').fill('Dimina')
        await visible(page, '输入：Dimina')
      })
    })

    it('renders named/scoped slots through componentGenerics', async () => {
      await withPage('wevu', async (page) => {
        await visible(page, 'wevu 计数：0')
        await visible(page, '具名插槽')
        await visible(page, '作用域值：0')
        await content(page).getByText('wevu 加一', { exact: true }).click()
        await visible(page, '作用域值：1')
        await content(page).getByText('插槽加一', { exact: true }).click()
        await visible(page, '作用域值：2')
        await visible(page, 'wevu 计数：2')
      })
    })

    it('omits the component host for virtualHost components', async () => {
      await withPage('wevu', async (page) => {
        await visible(page, 'wevu 计数：0')
        await expect.poll(() => content(page).locator('.slot-probe').evaluate(element => element.parentElement?.hasAttribute('data-dd-component-host'))).toBe(false)
        await expect.poll(() => content(page).locator('.slot-probe').evaluate(element => getComputedStyle(element).color)).toBe('rgb(18, 52, 86)')
      })
    })

    it('isolates generic instances, defaults, forwarding, events and virtualHost cleanup', async () => {
      await withPage('native', async (page) => {
        await visible(page, '原生计数：0')
        await content(page).getByText('泛型边界测试', { exact: true }).click()
        await visible(page, '泛型边界')
        await expect.poll(() => content(page).locator('.generic-alpha').count()).toBe(2)
        await visible(page, 'beta:1')
        await visible(page, 'fallback:1')
        await content(page).getByText('选择 alpha', { exact: true }).first().click()
        await visible(page, '事件归属：first:alpha:1')
        await content(page).getByText('选择 beta', { exact: true }).click()
        await visible(page, '事件归属：second:beta:1')
        await content(page).getByText('选择 alpha', { exact: true }).last().click()
        await visible(page, '事件归属：forwarded:alpha:1')
        await content(page).getByText('更新泛型属性', { exact: true }).click()
        await visible(page, 'beta:2')
        await visible(page, 'fallback:2')
        await expect.poll(() => content(page).getByText('alpha:2', { exact: true }).count()).toBe(2)
        expect(await content(page).locator('.generic-alpha').first().evaluate(element => element.parentElement?.hasAttribute('data-dd-component-host'))).toBe(true)
        expect(await content(page).locator('[name="/components/generic-outlet/index"]').count()).toBe(0)
        await content(page).getByText('移除首个实例', { exact: true }).click()
        await expect.poll(() => content(page).locator('.generic-alpha').count()).toBe(1)
        await content(page).getByText('读取卸载次数', { exact: true }).click()
        await visible(page, '卸载次数：1')
        await content(page).getByText('恢复首个实例', { exact: true }).click()
        await expect.poll(() => content(page).getByText('alpha:2', { exact: true }).count()).toBe(2)
        await content(page).getByText('选择 alpha', { exact: true }).first().click()
        await visible(page, '事件归属：first:alpha:2')
        await content(page).getByText('移除首个实例', { exact: true }).click()
        await expect.poll(() => content(page).locator('.generic-alpha').count()).toBe(1)
        await content(page).getByText('读取卸载次数', { exact: true }).click()
        await visible(page, '卸载次数：2')
      })
    })

    it('runs React state, lists and native component events', async () => {
      await withPage('react', async (page) => {
        await visible(page, 'React 计数：0')
        await content(page).getByText('React 加一', { exact: true }).click()
        await visible(page, 'React 计数：1')
        await content(page).getByText('React 组件事件', { exact: true }).click()
        await visible(page, 'React 计数：2')
        await content(page).getByText('打开 React 列表', { exact: true }).click()
        await visible(page, '初始条目')
        await content(page).getByText('添加条目', { exact: true }).click()
        await visible(page, '条目 1')
      })
    })

    it('reports missing app resources instead of claiming launch success', async () => {
      const page = await browser.newPage()
      try {
        await page.route('**/main/app-config.json', route => route.fulfill({ status: 404, body: 'missing' }))
        await page.goto(`${host.url}?example=native`)
        await expect.poll(() => page.locator('#status').textContent(), { timeout: 30_000 }).toContain('启动失败')
      }
      finally {
        await page.close()
      }
    })

    it('reports SDK loading failures', async () => {
      const page = await browser.newPage()
      try {
        await page.route(url => url.pathname.endsWith('/dimina-sdk/index.js'), route => route.fulfill({ status: 404, body: 'missing' }))
        await page.goto(`${host.url}?example=native`)
        await expect.poll(() => page.locator('#status').textContent(), { timeout: 30_000 }).toContain('启动失败')
      }
      finally {
        await page.close()
      }
    })

    if (mode === 'dev') {
      it('keeps the last good resources on failure and reloads after recovery', async () => {
        const file = path.join(root, 'fixtures/native/src/pages/index/index.js')
        const original = await readFile(file, 'utf8')
        await withPage('native', async (page) => {
          await visible(page, '原生计数：0')
          try {
            await writeFile(file, 'Page({ invalid syntax')
            await expect.poll(() => page.locator('#status').textContent(), { timeout: 60_000 }).toContain('构建失败')
            await visible(page, '原生计数：0')
            await writeFile(file, original.replace('count: 0', 'count: 7'))
            await visible(page, '原生计数：7')
          }
          finally {
            await writeFile(file, original)
            await visible(page, '原生计数：0')
          }
        })
      })
    }
  })
}
