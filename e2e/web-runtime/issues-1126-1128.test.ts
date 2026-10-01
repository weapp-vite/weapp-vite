import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { buildIssue1126Project, createIssue1126Project } from '../utils/issue1126Project'
import { createWebDevServerEnv, resolveWebDevServerUrl } from '../utils/webDevServer'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ACTIVE = '[data-weapp-page-active="true"]'

async function style(page: Page, selector: string) {
  return page.locator(`${ACTIVE} ${selector}`).evaluate((element) => {
    const computed = getComputedStyle(element)
    return { color: computed.color, fontSize: computed.fontSize, fontWeight: computed.fontWeight }
  })
}

describe('issues #1126–#1128: Web component boundaries', { concurrent: false }, () => {
  let project: string
  let browser: Browser
  let server: PreviewServer
  let page: Page
  const errors: string[] = []

  beforeAll(async () => {
    project = await createIssue1126Project()
    await buildIssue1126Project(project)
    server = await preview({ root: project, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0, open: false } })
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
    page = await browser.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(new URL('/pages/index/index', server.resolvedUrls!.local[0]).href)
    await page.locator(`${ACTIVE} #click-count`).waitFor()
  })

  afterAll(async () => {
    await browser?.close()
    if (server) {
      await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
    }
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  })

  it('applies app external and inline styles while preserving Shadow DOM isolation and theme variables', async () => {
    await expect.poll(() => style(page, '#global-style')).toEqual({ color: 'rgb(231, 17, 83)', fontSize: '32px', fontWeight: '700' })
    for (const selector of ['#theme-style', '#isolated-probe .theme-probe', '#apply-probe .theme-probe', '#shared-probe .theme-probe']) {
      expect((await style(page, selector)).color).toBe('rgb(15, 130, 80)')
    }
    for (const selector of ['#apply-probe .global-probe', '#shared-probe .global-probe']) {
      expect((await style(page, selector)).color).toBe('rgb(231, 17, 83)')
    }
    expect((await style(page, '#isolated-probe .global-probe')).color).not.toBe('rgb(231, 17, 83)')
    expect(await page.locator(`${ACTIVE} #isolated-probe`).evaluate(element => Boolean(element.shadowRoot))).toBe(true)
  })

  it('handles one physical click as one custom event and preserves details and native taps', async () => {
    await page.locator(`${ACTIVE} #emit-click`).click()
    await expect.poll(() => page.locator(`${ACTIVE} #click-count`).textContent()).toBe('1')
    expect(await page.locator(`${ACTIVE} #event-detail`).textContent()).toBe('component-click')
    expect(await page.locator(`${ACTIVE} #custom-count`).textContent()).toBe('1')
    await page.locator(`${ACTIVE} #native-click`).click()
    await expect.poll(() => page.locator(`${ACTIVE} #native-count`).textContent()).toBe('1')
    expect(await page.locator(`${ACTIVE} #click-count`).textContent()).toBe('1')
  })

  it('keeps Boolean inputs separate from a same-name callable setup method across parent updates', async () => {
    for (const id of ['default-prop', 'controlled-prop']) {
      expect(await page.locator(`${ACTIVE} #${id} .prop-value`).textContent()).toBe('false')
    }
    expect(await page.locator(`${ACTIVE} #true-prop .prop-value`).textContent()).toBe('true')
    for (const expected of ['true', 'false']) {
      await page.locator(`${ACTIVE} #toggle-prop`).click()
      await expect.poll(() => page.locator(`${ACTIVE} #controlled-prop .prop-value`).textContent()).toBe(expected)
      await page.locator(`${ACTIVE} #controlled-prop .call-back`).click()
    }
    await expect.poll(() => page.locator(`${ACTIVE} #controlled-prop .method-count`).textContent()).toBe('2')
    expect(await page.locator(`${ACTIVE} #controlled-prop .prop-value`).textContent()).toBe('false')
    expect(errors).toEqual([])
  })

  it('updates external and inline app styles in dev without losing current component state', async () => {
    const developmentProject = await createIssue1126Project()
    const dev = startDevProcess(process.execPath, [path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'), 'dev', developmentProject, '--platform', 'web'], {
      cwd: ROOT,
      env: createWebDevServerEnv(createDevProcessEnv()),
      all: true,
    })
    const devPage = await browser.newPage()
    const diagnostics: string[] = []
    devPage.on('console', message => diagnostics.push(message.text()))
    devPage.on('pageerror', error => diagnostics.push(error.message))
    devPage.on('websocket', socket => socket.on('framereceived', frame => diagnostics.push(String(frame.payload))))
    try {
      await dev.waitFor(expect.poll(() => resolveWebDevServerUrl(dev.getOutput()), { timeout: 60_000 }).toBeTypeOf('string'), 'Web server starts')
      await devPage.goto(new URL('/pages/index/index', resolveWebDevServerUrl(dev.getOutput())!).href)
      await expect.poll(() => style(devPage, '#global-style')).toMatchObject({ color: 'rgb(231, 17, 83)', fontWeight: '700' })
      await devPage.locator(`${ACTIVE} #native-click`).click()
      await expect.poll(() => devPage.locator(`${ACTIVE} #native-count`).textContent()).toBe('1')
      const css = path.join(developmentProject, 'src/app.css')
      await writeFile(css, (await readFile(css, 'utf8')).replace('231 17 83', '20 60 180').replace('15 130 80', '90 20 120'))
      await expect.poll(() => style(devPage, '#global-style'), { timeout: 15_000 }).toMatchObject({ color: 'rgb(20, 60, 180)' })
      await expect.poll(() => style(devPage, '#isolated-probe .theme-probe'), { timeout: 15_000 }).toMatchObject({ color: 'rgb(90, 20, 120)' })
      const app = path.join(developmentProject, 'src/app.vue')
      await writeFile(app, (await readFile(app, 'utf8')).replace('font-weight: 700', 'font-weight: 400'))
      await expect.poll(() => style(devPage, '#global-style'), { timeout: 15_000 }).toMatchObject({ color: 'rgb(20, 60, 180)', fontWeight: '400' })
      expect(await devPage.locator(`${ACTIVE} #native-count`).textContent()).toBe('1')
    }
    catch (error) {
      throw new Error(`Web HMR diagnostics:\n${dev.getOutput()}\n${diagnostics.join('\n')}`, { cause: error })
    }
    finally {
      await devPage.close()
      await dev.stop(5_000)
      await rm(developmentProject, { recursive: true, force: true })
    }
  })
})
