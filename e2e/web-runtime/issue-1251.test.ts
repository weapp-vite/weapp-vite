import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { access, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { stripVTControlCharacters } from 'node:util'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { readJavaScriptOutput } from '../utils/runtimeProviderOutput'
import { createWebDevServerEnv, resolveWebDevServerUrl } from '../utils/webDevServer'

interface NavigationHost {
  wx: { reLaunch: (options: { url: string }) => Promise<unknown> }
}

const ROOT = path.resolve(import.meta.dirname, '../..')
const ACTIVE_PAGE = '[data-weapp-page-active="true"]'

function tagWarnings(output: string, tag?: string, filename?: string) {
  return stripVTControlCharacters(output).replace(/\\/g, '/').split(/\r?\n/).filter(line => line.includes('[@weapp-vite/web]') && (line.includes('未知标签') || line.includes('Web 端未实现'))).filter(line => (!tag || line.includes(`<${tag}>`)) && (!filename || line.includes(`${filename}:`)))
}

async function originalLocation(project: string, filename: string, tag: string) {
  const source = await readFile(path.join(project, filename), 'utf8')
  const offset = source.indexOf(`<${tag}`)
  if (offset < 0) {
    throw new Error(`Missing fixture tag <${tag}> in ${filename}`)
  }
  const preceding = source.slice(0, offset).split(/\r\n?|\n/)
  return `${filename}:${preceding.length}:${preceding.at(-1)!.length + 1}`
}

describe('issue #1251: source-owned Web development tag diagnostics', { concurrent: false }, () => {
  let browser: Browser | undefined
  let page: Page | undefined
  let project: string | undefined
  let errors: string[] = []
  let allowProjectRemoval = true

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  beforeEach(async () => {
    project = undefined
    page = undefined
    errors = []
    allowProjectRemoval = true
    project = await createIssueRegressionProject(1251)
    page = await browser!.newPage()
    page.on('pageerror', error => errors.push(error.message))
  })

  afterEach(async () => {
    try {
      await page?.close()
    }
    finally {
      if (project && allowProjectRemoval) {
        await rm(project, { recursive: true, force: true })
      }
    }
    expect(errors).toEqual([])
  })

  afterAll(async () => {
    await browser?.close()
  })

  async function openRoute(route: string, ready: string) {
    await page!.evaluate(async (url) => {
      const host = globalThis as unknown as NavigationHost
      await host.wx.reLaunch({ url })
    }, route)
    await expect.poll(() => page!.locator(`${ACTIVE_PAGE} #ready`).textContent()).toBe(ready)
  }

  it('reports actual WXML, layout, dependency and SFC source positions and updates after real saves', async () => {
    const fixture = project!
    const nativeFile = 'src/pages/index/index.wxml'
    const sourcePath = path.join(fixture, nativeFile)
    const source = await readFile(sourcePath, 'utf8')
    const browserTrace: string[] = []
    page!.on('websocket', (socket) => {
      browserTrace.push(`websocket open ${socket.url()}`)
      socket.on('framereceived', frame => browserTrace.push(`websocket received ${String(frame.payload)}`))
      socket.on('close', () => browserTrace.push('websocket closed'))
    })
    page!.on('response', (response) => {
      if (/\.(?:wxml|vue)(?:\?|$)/.test(response.url())) {
        browserTrace.push(`module response ${response.status()} ${response.url()}`)
      }
    })
    allowProjectRemoval = false
    const dev = startDevProcess(process.execPath, [
      path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
      'dev',
      fixture,
      '--platform',
      'web',
      '--host',
      '127.0.0.1',
    ], {
      cwd: ROOT,
      env: { ...createWebDevServerEnv(createDevProcessEnv()), WEAPP_WEB_PORT: '0', DEBUG: 'vite:hmr' },
      all: true,
    })
    try {
      await dev.waitFor(expect.poll(() => resolveWebDevServerUrl(dev.getOutput()), { timeout: 90_000 }).toBeTypeOf('string'), 'Web diagnostic fixture starts')
      await page!.goto(resolveWebDevServerUrl(dev.getOutput())!)
      await dev.waitFor(expect.poll(() => page!.locator(`${ACTIVE_PAGE} #ready`).textContent(), { timeout: 30_000 }).toBe('native-ready'), 'Web diagnostic fixture renders its initial page')
      expect(await page!.locator(`${ACTIVE_PAGE} #layout-shell`).count()).toBe(1)
      expect(await page!.locator(`${ACTIVE_PAGE} #direct-card #registered-card`).textContent()).toBe('Registered component')
      expect(await page!.locator(`${ACTIVE_PAGE} #raw-unknown`).textContent()).toBe('Original typo')
      await openRoute('/pages/other/index', 'other-ready')
      // 既有 include 会被布局编译提到顶层；此处覆盖源码节点保留，组件注册由直接页面节点验证。
      expect(await page!.locator(`${ACTIVE_PAGE} #shared-unknown`).allTextContents()).toContain('Shared source remains visible')
      await openRoute('/pages/sfc/index', 'sfc-ready')
      expect(await page!.locator(`${ACTIVE_PAGE} #registered-sfc-card`).textContent()).toBe('Registered SFC component')
      expect(await page!.locator(`${ACTIVE_PAGE} #sfc-included`).textContent()).toBe('Included SFC source')
      expect(await page!.locator(`${ACTIVE_PAGE} #sfc-imported`).textContent()).toBe('Imported SFC source')
      await openRoute('/pages/external/index', 'external-ready')
      expect(await page!.locator(`${ACTIVE_PAGE} #external-unknown`).textContent()).toBe('External SFC typo')

      for (const [tag, filename, count, reason] of [
        ['buton', nativeFile, 1, '未知标签'],
        ['web-view', nativeFile, 1, 'Web 端未实现'],
        ['layout-typo', 'src/layouts/default/index.wxml', 1, '未知标签'],
        ['scope-card', 'src/shared/card.wxml', 1, '未知标签'],
        ['shared-typo', 'src/shared/card.wxml', 2, '未知标签'],
        ['sfc-typo', 'src/pages/sfc/index.vue', 1, '未知标签'],
        ['external-typo', 'src/pages/external/view.html', 1, '未知标签'],
        ['sfc-included-typo', 'src/shared/sfc-include.wxml', 2, '未知标签'],
        ['sfc-imported-typo', 'src/shared/sfc-import.wxml', 2, '未知标签'],
      ] as const) {
        const location = await originalLocation(fixture, filename, tag)
        await dev.waitFor(expect.poll(() => tagWarnings(dev.getOutput(), tag, filename)).toHaveLength(count), `${tag} reports only its invalid registration scopes`)
        expect(tagWarnings(dev.getOutput(), tag, filename).every(message => message.includes(location) && message.includes(reason))).toBe(true)
      }
      expect(tagWarnings(dev.getOutput()).some(message => /<(?:SfcCard|sfc-card|foreignObject|foreign-object|wx-include|weapp-navigation-bar)>/.test(message))).toBe(false)

      await openRoute('/pages/index/index', 'native-ready')
      await writeFile(sourcePath, source.replaceAll('buton', 'view').replace('Original typo', 'Corrected source'))
      await dev.waitFor(expect.poll(() => page!.locator(`${ACTIVE_PAGE} #raw-unknown`).textContent(), { timeout: 15_000 }).toBe('Corrected source'), 'A corrected source is rendered before reintroducing the tag')
      const reintroduced = `\n\n${source.replace('Original typo', 'Reintroduced typo')}`
      await writeFile(sourcePath, reintroduced)
      await dev.waitFor(expect.poll(() => page!.locator(`${ACTIVE_PAGE} #raw-unknown`).textContent(), { timeout: 15_000 }).toBe('Reintroduced typo'), 'The reintroduced typo remains renderable')
      const updatedLocation = await originalLocation(fixture, nativeFile, 'buton')
      await dev.waitFor(expect.poll(() => tagWarnings(dev.getOutput(), 'buton', nativeFile)).toHaveLength(2), 'A corrected and reintroduced tag is diagnosed again')
      expect(tagWarnings(dev.getOutput(), 'buton', nativeFile).at(-1)).toContain(updatedLocation)
      await writeFile(sourcePath, reintroduced.replace('Reintroduced typo', 'Final source'))
      await dev.waitFor(expect.poll(() => page!.locator(`${ACTIVE_PAGE} #raw-unknown`).textContent(), { timeout: 15_000 }).toBe('Final source'), 'A subsequent source change keeps the same diagnostic location')
      expect(tagWarnings(dev.getOutput(), 'buton', nativeFile)).toHaveLength(2)

      await openRoute('/pages/sfc/index', 'sfc-ready')
      const includedFile = 'src/shared/sfc-include.wxml'
      const includedPath = path.join(fixture, includedFile)
      const includedSource = await readFile(includedPath, 'utf8')
      await writeFile(includedPath, includedSource.replaceAll('sfc-included-typo', 'view').replace('Included SFC source', 'Corrected include'))
      await dev.waitFor(expect.poll(() => page!.locator(`${ACTIVE_PAGE} #sfc-included`).textContent(), { timeout: 15_000 }).toBe('Corrected include'), 'An actual SFC include save updates its owner')
      await writeFile(includedPath, `\n\n${includedSource.replace('Included SFC source', 'Reintroduced include')}`)
      await dev.waitFor(expect.poll(() => page!.locator(`${ACTIVE_PAGE} #sfc-included`).textContent(), { timeout: 15_000 }).toBe('Reintroduced include'), 'The SFC dependency is reintroduced after correction')
      const includedLocation = await originalLocation(fixture, includedFile, 'sfc-included-typo')
      await dev.waitFor(expect.poll(() => tagWarnings(dev.getOutput(), 'sfc-included-typo', includedFile).some(message => message.includes(includedLocation))).toBe(true), 'The dependency diagnostic follows its source after HMR')
    }
    catch (error) {
      const files = await Promise.allSettled([nativeFile, 'src/shared/sfc-include.wxml'].map(async (file) => {
        const filename = path.join(fixture, file)
        const [metadata, content] = await Promise.all([stat(filename), readFile(filename, 'utf8')])
        return { file, size: metadata.size, mtimeMs: metadata.mtimeMs, source: content }
      }))
      throw new Error(`Web source-save diagnostics:\n${dev.getOutput()}\n${browserTrace.join('\n')}\n${JSON.stringify(files)}`, { cause: error })
    }
    finally {
      try {
        await page!.goto('about:blank')
      }
      finally {
        await dev.stop(5_000)
        allowProjectRemoval = true
      }
    }
  })

  it('builds and renders the same fixture without production tag warnings', async () => {
    const fixture = project!
    const result = await buildIssueRegressionProject(fixture)
    expect(tagWarnings(`${result.stdout}\n${result.stderr}`)).toEqual([])
    await access(path.join(fixture, 'dist/web/index.html'))
    expect((await readJavaScriptOutput(path.join(fixture, 'dist/web'))).files.length).toBeGreaterThan(0)
    const consoleMessages: string[] = []
    page!.on('console', message => consoleMessages.push(message.text()))
    let server: PreviewServer | undefined
    allowProjectRemoval = false
    try {
      server = await preview({ root: fixture, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0, open: false } })
      await page!.goto(server.resolvedUrls!.local[0])
      await expect.poll(() => page!.locator(`${ACTIVE_PAGE} #ready`).textContent()).toBe('native-ready')
      expect(await page!.locator(`${ACTIVE_PAGE} #raw-unknown`).textContent()).toBe('Original typo')
      await openRoute('/pages/sfc/index', 'sfc-ready')
      expect(await page!.locator(`${ACTIVE_PAGE} #sfc-unknown`).textContent()).toBe('Inline SFC typo')
      expect(await page!.locator(`${ACTIVE_PAGE} #sfc-included`).textContent()).toBe('Included SFC source')
      expect(await page!.locator(`${ACTIVE_PAGE} #sfc-imported`).textContent()).toBe('Imported SFC source')
      await openRoute('/pages/external/index', 'external-ready')
      expect(await page!.locator(`${ACTIVE_PAGE} #external-unknown`).textContent()).toBe('External SFC typo')
      expect(tagWarnings(consoleMessages.join('\n'))).toEqual([])
    }
    finally {
      try {
        await page!.goto('about:blank')
      }
      finally {
        if (server) {
          await new Promise<void>((resolve, reject) => server!.httpServer.close(error => error ? reject(error) : resolve()))
          allowProjectRemoval = true
        }
      }
    }
  })
})
