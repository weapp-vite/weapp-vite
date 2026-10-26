import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { copyFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

const variants = [
  { name: 'variable', wxss: { designWidth: 375, rpxVar: '--fixture-rpx' }, styleUnits: { useVariable: true, ratio: 0.5, rpxVar: '--fixture-rpx', designWidth: 375 }, rpx: { designWidth: 375, varName: '--fixture-rpx' } },
  { name: 'static', wxss: { pxPerRpx: 0.25 }, styleUnits: { useVariable: false, ratio: 0.25, rpxVar: '--rpx', designWidth: 750 }, rpx: null },
] as const
const cases = variants.flatMap(variant => ['compiled', 'legacy'].map(mode => ({ variant, mode })))

describe('issue #1248: inline style computed dimensions', { concurrent: false }, () => {
  const projects: string[] = []
  const servers: PreviewServer[] = []
  let browser: Browser | undefined
  let page: Page
  let errors: string[]

  beforeAll(async () => {
    for (const { variant, mode } of cases) {
      const project = await createIssueRegressionProject(1248)
      projects.push(project)
      await writeFile(path.join(project, 'fixtureConfig.ts'), `export const fixture = ${JSON.stringify(variant)}\n`)
      if (mode === 'legacy') {
        await copyFile(path.join(project, 'legacy.html'), path.join(project, 'index.html'))
      }
      await buildIssueRegressionProject(project)
      servers.push(await preview({ root: project, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0, open: false } }))
    }
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  beforeEach(async () => {
    page = await browser!.newPage({ viewport: { width: 1200, height: 900 } })
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

  async function size(selector: string) {
    return page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element)
      return { width: Number.parseFloat(style.width), height: Number.parseFloat(style.height) }
    })
  }

  it.each(cases)('$mode / $variant.name shares configured units with WXSS through updates and removal', async ({ variant, mode }) => {
    await page.goto(servers[cases.findIndex(item => item.variant.name === variant.name && item.mode === mode)].resolvedUrls!.local[0])
    const root = mode === 'compiled' ? '[data-weapp-page-active="true"]' : 'inline-style-legacy-fixture'
    const probe = `${root} #probe`
    const array = `${root} #array`
    const ratio = variant.name === 'variable' ? 400 / 375 : 0.25
    const viewportWidth = variant.name === 'variable' ? 400 : 1200
    await expect.poll(async () => (await size(probe)).height).toBeCloseTo(200 * ratio, 1)
    expect((await size(probe)).width).toBeCloseTo(viewportWidth / 2, 1)
    expect((await size(array)).width).toBeCloseTo(40 * ratio, 1)
    expect((await size(array)).height).toBeCloseTo(80 * ratio, 1)
    if (mode === 'compiled') {
      const reference = await size(`${root} #reference`)
      expect((await size(probe)).width).toBeCloseTo(reference.width, 1)
      expect((await size(probe)).height).toBeCloseTo(reference.height, 1)
    }
    await page.locator(`${root} #replace`).click()
    await expect.poll(async () => (await size(probe)).height).toBeCloseTo(400 * ratio, 1)
    expect((await size(array)).height).toBeCloseTo(160 * ratio, 1)
    await page.locator(`${root} #clear`).click()
    for (const selector of [probe, array]) {
      await expect.poll(() => page.locator(selector).evaluate(element => (element as HTMLElement).style.width)).toBe('')
      expect(await page.locator(selector).evaluate(element => (element as HTMLElement).style.height)).toBe('')
    }
    await page.locator(`${root} #restore`).click()
    await expect.poll(async () => (await size(probe)).height).toBeCloseTo(100 * ratio, 1)
    expect((await size(probe)).width).toBeCloseTo(viewportWidth / 4, 1)
  })
})
