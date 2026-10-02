import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { copyFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

const ACTIVE_PAGE = '[data-weapp-page-active="true"]'

async function serveProject(project: string) {
  await buildIssueRegressionProject(project)
  return await preview({ root: project, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0, open: false } })
}

describe('issue #1127: component and native event channels', { concurrent: false }, () => {
  const projects: string[] = []
  const servers: PreviewServer[] = []
  let browser: Browser | undefined
  let page: Page
  let errors: string[]

  beforeAll(async () => {
    const project = await createIssueRegressionProject(1127)
    projects.push(project)
    servers.push(await serveProject(project))
    const legacyProject = await createIssueRegressionProject(1127)
    projects.push(legacyProject)
    await copyFile(path.join(legacyProject, 'legacy.html'), path.join(legacyProject, 'index.html'))
    servers.push(await serveProject(legacyProject))
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  beforeEach(async () => {
    page = await browser!.newPage()
    errors = []
    page.on('pageerror', error => errors.push(error.message))
  })

  afterEach(async () => {
    await page?.close()
    expect(errors).toEqual([])
  })

  afterAll(async () => {
    await browser?.close()
    for (const server of servers) {
      await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
    }
    for (const project of projects) {
      await rm(project, { recursive: true, force: true })
    }
  })

  async function text(selector: string, expected: string) {
    await expect.poll(() => page.locator(selector).textContent()).toBe(expected)
  }

  it('1127.click-once', async () => {
    await page.goto(servers[0].resolvedUrls!.local[0])
    await text(`${ACTIVE_PAGE} #custom-count`, '0')
    await page.locator(`${ACTIVE_PAGE} #emit-probe #emit-click`).click()
    await text(`${ACTIVE_PAGE} #custom-count`, '1')
    await text(`${ACTIVE_PAGE} #host-tap-count`, '1')
    await page.locator(`${ACTIVE_PAGE} #emit-probe #native-only`).click()
    await text(`${ACTIVE_PAGE} #host-tap-count`, '2')
    await text(`${ACTIVE_PAGE} #custom-count`, '1')
  })

  it('1127.custom-detail', async () => {
    await page.goto(servers[0].resolvedUrls!.local[0])
    await page.locator(`${ACTIVE_PAGE} #emit-probe #emit-payload`).click()
    await text(`${ACTIVE_PAGE} #custom-detail`, 'kept-detail:7')
    await text(`${ACTIVE_PAGE} #custom-count`, '0')
  })

  it('1127.native-events', async () => {
    await page.goto(servers[0].resolvedUrls!.local[0])
    await page.locator(`${ACTIVE_PAGE} #native-tap`).click()
    await page.locator(`${ACTIVE_PAGE} #native-click`).click()
    await text(`${ACTIVE_PAGE} #native-tap-count`, '1')
    await text(`${ACTIVE_PAGE} #native-click-count`, '1')
    await page.locator(`${ACTIVE_PAGE} #emit-probe #native-only`).click()
    await text(`${ACTIVE_PAGE} #host-tap-count`, '1')
    await text(`${ACTIVE_PAGE} #custom-count`, '0')
    await page.locator(`${ACTIVE_PAGE} #emit-probe #nested-input textarea`).fill('A')
    await text(`${ACTIVE_PAGE} #input-count`, '1')
    await text(`${ACTIVE_PAGE} #input-value`, 'component:A')
    await page.locator(`${ACTIVE_PAGE} #native-input textarea`).fill('B')
    await text(`${ACTIVE_PAGE} #native-input-value`, 'B')
  })

  it('1127.explicit-bubbling', async () => {
    await page.goto(servers[0].resolvedUrls!.local[0])
    const boundary = `${ACTIVE_PAGE} #signal-boundary`
    await page.locator(`${boundary} #open-signal #emit-private`).click()
    await text(`${boundary} #signal-detail`, '11')
    await text(`${ACTIVE_PAGE} #page-signal-count`, '0')
    await page.locator(`${boundary} #reset-signal`).click()
    await page.locator(`${boundary} #open-signal #emit-local`).click()
    await text(`${boundary} #signal-trace`, 'capture,direct,bubble')
    await text(`${boundary} #signal-detail`, '23')
    await text(`${ACTIVE_PAGE} #page-signal-count`, '0')
    await page.locator(`${boundary} #reset-signal`).click()
    await page.locator(`${boundary} #open-signal #emit-public`).click()
    await text(`${boundary} #signal-trace`, 'capture,direct,bubble')
    await text(`${ACTIVE_PAGE} #page-signal-count`, '1')
    await text(`${ACTIVE_PAGE} #page-signal-detail`, '37')
    await page.locator(`${boundary} #reset-signal`).click()
    await page.locator(`${boundary} #caught-signal #emit-public`).click()
    await text(`${boundary} #signal-trace`, 'capture,catch')
    await text(`${ACTIVE_PAGE} #page-signal-count`, '1')
    await page.locator(`${boundary} #reset-signal`).click()
    await page.locator(`${boundary} #capture-caught-signal #emit-public`).click()
    await text(`${boundary} #signal-trace`, 'capture,capture-catch')
    await text(`${ACTIVE_PAGE} #page-signal-count`, '1')
  })

  it('1127.legacy-channels', async () => {
    await page.goto(servers[1].resolvedUrls!.local[0])
    await page.locator('#source #emit-click').click()
    await text('#legacy-count', '1')
    await text('#legacy-taps', '1')
    await page.locator('#source #native-only').click()
    await text('#legacy-count', '1')
    await text('#legacy-taps', '2')
    await page.locator('#source #emit-case').click()
    await text('#legacy-detail', 'onReady:legacy-detail:7')
    await text('#legacy-lower', '0')
    await page.locator('#source #nested-input textarea').fill('A')
    await text('#legacy-input-count', '1')
    await text('#legacy-input-value', 'component:A')
    await page.locator('#native-tap').click()
    await page.locator('#native-click').click()
    await text('#legacy-taps', '4')
    await text('#legacy-native-clicks', '1')
    await page.locator('#filtered-catch #emit-click').click()
    await text('#legacy-count', '2')
    await text('#legacy-native-ancestor', '1')
    await page.locator('#source #emit-local').click()
    await text('#legacy-trace', 'capture,direct,bubble')
    await text('#legacy-outer', '0')
    await page.locator('#source #emit-public').click()
    await text('#legacy-trace', 'capture,direct,bubble')
    await text('#legacy-outer', '1')
    await text('#legacy-outer-detail', '37')
    await page.locator('#caught #emit-public').click()
    await text('#legacy-trace', 'capture,catch')
    await text('#legacy-outer', '1')
    await page.locator('#capture-caught #emit-public').click()
    await text('#legacy-trace', 'capture,capture-catch')
    await text('#legacy-outer', '1')
    await page.locator('#register-late').click()
    await page.locator('#late-source #emit-late').click()
    await text('#legacy-late-count', '1')
  })

  it('1127.legacy-style-updates', async () => {
    await page.goto(servers[1].resolvedUrls!.local[0])
    const button = page.locator('#source #emit-click')
    const original = await button.elementHandle()
    if (!original) {
      throw new Error('Missing legacy event source')
    }
    for (let update = 0; update < 3; update++) {
      await page.locator('#legacy-style-update').click()
      await button.evaluate(element => Reflect.get((element.getRootNode() as ShadowRoot).host, 'updateComplete'))
      expect(await button.evaluate((element, previous) => element === previous, original)).toBe(true)
    }
    await button.click()
    await text('#legacy-count', '1')
    await text('#legacy-taps', '1')
    await original.dispose()
  })
})
