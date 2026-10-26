import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { access, copyFile, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

describe('issue #1249: dataset values across Web templates', { concurrent: false }, () => {
  const projects: string[] = []
  const servers: PreviewServer[] = []
  let browser: Browser | undefined
  let page: Page
  let errors: string[]

  beforeAll(async () => {
    for (const legacy of [false, true]) {
      const project = await createIssueRegressionProject(1249)
      projects.push(project)
      if (legacy) {
        await copyFile(path.join(project, 'legacy.html'), path.join(project, 'index.html'))
      }
      await buildIssueRegressionProject(project)
      servers.push(await preview({ root: project, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0, open: false } }))
    }
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

  async function dataset(selector: string, expected: Record<string, unknown>) {
    await expect.poll(async () => {
      const content = await page.locator(selector).textContent()
      return content ? JSON.parse(content) as unknown : undefined
    }).toMatchObject(expected)
  }

  it('emits the native page and component files required by DevTools', async () => {
    const project = await createIssueRegressionProject(1249)
    projects.push(project)
    await buildIssueRegressionProject(project, 'weapp')
    const config = JSON.parse(await readFile(path.join(project, 'project.config.json'), 'utf8')) as { miniprogramRoot: string }
    const output = path.resolve(project, config.miniprogramRoot)
    const app = JSON.parse(await readFile(path.join(output, 'app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toContain('pages/index/index')
    for (const base of [...app.pages, 'components/datasetProbe/index']) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(output, `${base}.${extension}`))
      }
    }
  })

  it.each(['compiled', 'legacy'])('%s preserves event, component, selector and observer dataset values', async (mode) => {
    await page.goto(servers[mode === 'compiled' ? 0 : 1].resolvedUrls!.local[0])
    const root = mode === 'compiled' ? '[data-weapp-page-active="true"]' : 'dataset-legacy-fixture'
    const row = `${root} #row-0`
    await expect.poll(() => page.locator(row).count()).toBe(1)
    expect(await page.locator(row).getAttribute('data-index')).toBe('0')
    expect(await page.locator(row).getAttribute('data-literal')).toBe('0')
    await page.locator(row).click()
    const expected = {
      item: { id: 'same', value: 'pending', nested: { count: 1 } },
      index: 0,
      enabled: false,
      literal: '0',
      itemName: 'pending',
    }
    await dataset(`${root} #snapshot`, expected)
    await page.locator(`${root} #query`).click()
    await dataset(`${root} #selector`, expected)
    await page.locator(`${root} #observe`).click()
    await dataset(`${root} #observer`, expected)
    await page.locator(`${root} #component-probe #emit-select`).click()
    await dataset(`${root} #snapshot`, { item: expected.item, index: 1 })
    await page.locator(`${root} #replace`).click()
    await expect.poll(() => page.locator(row).getAttribute('data-item-name')).toBe('complete')
    await page.locator(row).click()
    await dataset(`${root} #snapshot`, { item: { value: 'complete', nested: { count: 2 } }, index: 0 })
    await page.locator(`${root} #query`).click()
    await dataset(`${root} #selector`, { item: { value: 'complete', nested: { count: 2 } }, enabled: false })
    const retainedRow = await page.locator(row).elementHandle()
    if (!retainedRow) {
      throw new Error('Missing dataset row before reconnect')
    }
    try {
      await page.locator(root).evaluate(async (element) => {
        const parent = element.parentNode!
        const next = element.nextSibling
        element.remove()
        parent.insertBefore(element, next)
        await Reflect.get(element, 'updateComplete')
      })
      expect(await page.locator(row).evaluate((element, previous) => element === previous, retainedRow)).toBe(true)
      await page.locator(row).click()
      await dataset(`${root} #snapshot`, { item: { value: 'complete', nested: { count: 2 } }, enabled: false })
    }
    finally {
      await retainedRow.dispose()
    }
  })
})
