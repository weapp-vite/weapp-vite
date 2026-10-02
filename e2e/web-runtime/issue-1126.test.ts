import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { createWebDevServerEnv, resolveWebDevServerUrl } from '../utils/webDevServer'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ACTIVE_PAGE = '[data-weapp-page-active="true"]'
const IMPORT_STYLESHEET_URL = 'https://styles.example.test/issue-1126.css'

async function readStyle(page: Page, selector: string) {
  return await page.locator(`${ACTIVE_PAGE} ${selector}`).evaluate((element) => {
    const style = getComputedStyle(element)
    return { color: style.color, fontSize: style.fontSize, paddingLeft: style.paddingLeft, marginLeft: style.marginLeft }
  })
}

async function closePreview(server?: PreviewServer) {
  if (server) {
    await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
  }
}

async function serveProject(project: string) {
  await buildIssueRegressionProject(project)
  return await preview({ root: project, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0, open: false } })
}

describe('issue #1126: application style ownership', { concurrent: false }, () => {
  let project: string
  let browser: Browser | undefined
  let server: PreviewServer | undefined
  let page: Page
  let errors: string[]

  beforeAll(async () => {
    project = await createIssueRegressionProject(1126)
    // 外部 @import 保留至浏览器，由测试提供样式响应，不写入共用的小程序 fixture。
    const pageFile = path.join(project, 'src/pages/index/index.vue')
    const pageSource = await readFile(pageFile, 'utf8')
    await writeFile(pageFile, pageSource.replace('</template>', `
  <view class="cascade-container">
    <text id="cascade-probe" class="cascade-probe">Local cascade</text>
  </view>
  <text id="import-probe" class="import-probe">Imported local style</text>
</template>`))
    const cssFile = path.join(project, 'src/pages/index/index.css')
    const localStyle = await readFile(cssFile, 'utf8')
    await writeFile(cssFile, `@import url("${IMPORT_STYLESHEET_URL}");
${localStyle}
page .cascade-probe { color: red; }
.cascade-container .cascade-probe { color: blue; }
`)
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
    server = await serveProject(project)
  })

  beforeEach(async () => {
    page = await browser!.newPage()
    await page.route(IMPORT_STYLESHEET_URL, route => route.fulfill({
      contentType: 'text/css',
      body: '.import-probe { color: rgb(1, 2, 3); }',
    }))
    errors = []
    page.on('pageerror', error => errors.push(error.message))
  })

  afterEach(async () => {
    await page?.close()
    expect(errors).toEqual([])
  })

  afterAll(async () => {
    await closePreview(server)
    await browser?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  })

  it('1126.external-style', async () => {
    await page.goto(server!.resolvedUrls!.local[0])
    expect(await readStyle(page, '#global-probe')).toMatchObject({ color: 'rgb(231, 17, 83)', fontSize: '32px' })
    expect(await readStyle(page, '#local-probe')).toMatchObject({ color: 'rgb(15, 121, 37)', fontSize: '32px' })
  })

  it('1126.page-selector-specificity', async () => {
    await page.goto(server!.resolvedUrls!.local[0])
    expect(await readStyle(page, '#cascade-probe')).toMatchObject({ color: 'rgb(0, 0, 255)' })
  })

  it('1126.local-stylesheet-import', async () => {
    await page.goto(server!.resolvedUrls!.local[0])
    await expect.poll(() => readStyle(page, '#import-probe')).toMatchObject({ color: 'rgb(1, 2, 3)' })
    const importedUrls = await page.locator(ACTIVE_PAGE).evaluate((host) => {
      return Array.from(host.shadowRoot!.querySelectorAll('style'))
        .flatMap(style => Array.from(style.sheet?.cssRules ?? []))
        .filter(rule => rule.type === CSSRule.IMPORT_RULE)
        .map(rule => (rule as CSSImportRule).href)
    })
    expect(importedUrls).toContain(IMPORT_STYLESHEET_URL)
  })

  it('1126.inline-style', async () => {
    await page.goto(server!.resolvedUrls!.local[0])
    expect(await readStyle(page, '#inline-probe')).toMatchObject({ marginLeft: '19px' })
  })

  it('1126.isolation-and-theme', async () => {
    await page.goto(server!.resolvedUrls!.local[0])
    expect(await readStyle(page, '#isolated #box')).toMatchObject({ paddingLeft: '0px' })
    expect(await readStyle(page, '#default-isolation #box')).toMatchObject({ paddingLeft: '0px' })
    expect(await readStyle(page, '#local-theme #theme')).toMatchObject({ color: 'rgb(157, 47, 113)' })
    for (const id of ['apply-shared', 'shared', 'global-class']) {
      expect(await readStyle(page, `#${id} #box`)).toMatchObject({ paddingLeft: '13px' })
    }
    for (const id of ['isolated', 'apply-shared', 'shared', 'global-class']) {
      expect(await readStyle(page, `#${id} #theme`)).toMatchObject({ color: 'rgb(23, 91, 167)' })
    }
  })

  it('1126.native-app-style', async () => {
    const nativeProject = await createIssueRegressionProject(1126)
    let nativeServer: PreviewServer | undefined
    try {
      const css = await readFile(path.join(nativeProject, 'src/app.css'), 'utf8')
      await rm(path.join(nativeProject, 'src/app.vue'))
      await writeFile(path.join(nativeProject, 'src/app.js'), 'App({})\n')
      await writeFile(path.join(nativeProject, 'src/app.json'), JSON.stringify({ pages: ['pages/index/index'], window: { navigationStyle: 'custom' } }))
      await writeFile(path.join(nativeProject, 'src/app.wxss'), css)
      nativeServer = await serveProject(nativeProject)
      await page.goto(nativeServer.resolvedUrls!.local[0])
      expect(await readStyle(page, '#global-probe')).toMatchObject({ color: 'rgb(231, 17, 83)', fontSize: '32px' })
      expect(await readStyle(page, '#apply-shared #box')).toMatchObject({ paddingLeft: '13px' })
      expect(await readStyle(page, '#isolated #box')).toMatchObject({ paddingLeft: '0px' })
    }
    finally {
      await page.goto('about:blank')
      await closePreview(nativeServer)
      await rm(nativeProject, { recursive: true, force: true })
    }
  })

  it('1126.style-hmr', async () => {
    const devProject = await createIssueRegressionProject(1126)
    const cssFile = path.join(devProject, 'src/app.css')
    const appFile = path.join(devProject, 'src/app.vue')
    const dev = startDevProcess(process.execPath, [
      path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
      'dev',
      devProject,
      '--platform',
      'web',
      '--host',
      '127.0.0.1',
    ], {
      cwd: ROOT,
      env: { ...createWebDevServerEnv(createDevProcessEnv()), WEAPP_WEB_PORT: '0' },
      all: true,
    })
    try {
      await dev.waitFor(expect.poll(() => resolveWebDevServerUrl(dev.getOutput()), { timeout: 90_000 }).toBeTypeOf('string'), 'Web style server starts')
      await page.goto(resolveWebDevServerUrl(dev.getOutput())!)
      expect(await readStyle(page, '#global-probe')).toMatchObject({ color: 'rgb(231, 17, 83)', fontSize: '32px' })
      await page.locator(`${ACTIVE_PAGE} #increment`).click()
      await expect.poll(() => page.locator(`${ACTIVE_PAGE} #counter`).textContent()).toBe('1')
      await writeFile(cssFile, `
page { --probe-theme: rgb(151, 37, 113); }
.global-probe { color: rgb(41, 73, 191); font-size: 32px; }
.app-box { padding-left: 13px; }
`)
      await dev.waitFor(expect.poll(() => readStyle(page, '#global-probe'), { timeout: 45_000 }).toMatchObject({ color: 'rgb(41, 73, 191)' }), 'External app style refreshes')
      expect(await readStyle(page, '#isolated #theme')).toMatchObject({ color: 'rgb(151, 37, 113)' })
      const app = await readFile(appFile, 'utf8')
      await writeFile(appFile, app.replace('19px', '29px'))
      await dev.waitFor(expect.poll(() => readStyle(page, '#inline-probe'), { timeout: 45_000 }).toMatchObject({ marginLeft: '29px' }), 'Inline app style refreshes')
      await writeFile(path.join(devProject, 'src/pages/index/index.css'), `
.local-probe { color: rgb(179, 91, 7); }
.local-theme { --probe-theme: rgb(157, 47, 113); }
`)
      await dev.waitFor(expect.poll(() => readStyle(page, '#local-probe'), { timeout: 45_000 }).toMatchObject({ color: 'rgb(179, 91, 7)' }), 'External page style refreshes')
      await writeFile(path.join(devProject, 'src/components/applyShared/index.css'), `
.theme-probe { color: var(--probe-theme, rgb(0, 0, 0)); }
.app-box { margin-left: 7px; }
`)
      await dev.waitFor(expect.poll(() => readStyle(page, '#apply-shared #box'), { timeout: 45_000 }).toMatchObject({ marginLeft: '7px' }), 'External component style refreshes')
      expect(await readStyle(page, '#global-probe')).toMatchObject({ color: 'rgb(41, 73, 191)' })
      expect(await readStyle(page, '#local-theme #theme')).toMatchObject({ color: 'rgb(157, 47, 113)' })
      await writeFile(appFile, app.slice(0, app.indexOf('<style')))
      await dev.waitFor(expect.poll(() => readStyle(page, '#global-probe'), { timeout: 45_000 }).toMatchObject({ color: 'rgb(0, 0, 0)', fontSize: '16px' }), 'Removed app styles stop applying')
      expect(await readStyle(page, '#apply-shared #box')).toMatchObject({ paddingLeft: '0px' })
      expect(await readStyle(page, '#isolated #theme')).toMatchObject({ color: 'rgb(0, 0, 0)' })
      await writeFile(appFile, app)
      await dev.waitFor(expect.poll(() => readStyle(page, '#global-probe'), { timeout: 45_000 }).toMatchObject({ color: 'rgb(41, 73, 191)', fontSize: '32px' }), 'Re-added app styles apply')
      expect(await page.locator(`${ACTIVE_PAGE} #counter`).textContent()).toBe('1')
    }
    finally {
      await page.goto('about:blank')
      await dev.stop(5_000)
      await rm(devProject, { recursive: true, force: true })
    }
  })
})
