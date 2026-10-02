import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { rm } from 'node:fs/promises'
import process from 'node:process'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

const ACTIVE_PAGE = '[data-weapp-page-active="true"]'

describe('issue #1128: property and method ownership', { concurrent: false }, () => {
  let project: string
  let browser: Browser | undefined
  let server: PreviewServer | undefined
  let page: Page
  let errors: string[]

  const probe = (id: string) => page.locator(`${ACTIVE_PAGE} #${id}`)
  const readBack = (id: string) => probe(id).evaluate(element => Reflect.get(element, 'back'))

  beforeAll(async () => {
    project = await createIssueRegressionProject(1128)
    await buildIssueRegressionProject(project)
    server = await preview({ root: project, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0, open: false } })
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  beforeEach(async () => {
    errors = []
    page = await browser!.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(server!.resolvedUrls!.local[0])
  })

  afterEach(async () => {
    await page?.close()
    expect(errors).toEqual([])
  })

  afterAll(async () => {
    await browser?.close()
    if (server) {
      await new Promise<void>((resolve, reject) => server!.httpServer.close(error => error ? reject(error) : resolve()))
    }
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  })

  it('1128.default-false', async () => {
    await expect.poll(() => readBack('default-probe')).toBe(false)
    expect(await probe('default-probe').locator('#false-branch').count()).toBe(1)
    expect(await probe('default-probe').locator('#true-branch').count()).toBe(0)
  })

  it('1128.explicit-values', async () => {
    await expect.poll(() => readBack('explicit-false-probe')).toBe(false)
    await expect.poll(() => readBack('explicit-true-probe')).toBe(true)
    expect(await probe('explicit-false-probe').locator('#false-branch').count()).toBe(1)
    expect(await probe('explicit-true-probe').locator('#true-branch').count()).toBe(1)
    expect(await probe('explicit-false-probe').locator('#true-branch').count()).toBe(0)
    expect(await probe('explicit-true-probe').locator('#false-branch').count()).toBe(0)
  })

  it('1128.parent-update', async () => {
    await expect.poll(() => readBack('updated-probe')).toBe(false)
    expect(await probe('updated-probe').locator('#false-branch').count()).toBe(1)
    await probe('toggle-back').click()
    await expect.poll(() => readBack('updated-probe')).toBe(true)
    expect(await probe('updated-probe').locator('#true-branch').count()).toBe(1)
    await probe('updated-probe').locator('#call-back').click()
    await expect.poll(() => probe('updated-probe').locator('#handler-count').textContent()).toBe('1')
    await probe('toggle-back').click()
    await expect.poll(() => readBack('updated-probe')).toBe(false)
    expect(await probe('updated-probe').locator('#false-branch').count()).toBe(1)
    await probe('updated-probe').locator('#call-back').click()
    await expect.poll(() => probe('updated-probe').locator('#handler-count').textContent()).toBe('2')
  })

  it('1128.handler-callable', async () => {
    for (const id of ['default-probe', 'explicit-false-probe', 'explicit-true-probe']) {
      await probe(id).locator('#call-back').click()
      await expect.poll(() => probe(id).locator('#handler-count').textContent()).toBe('1')
      const branch = id === 'explicit-true-probe' ? '#true-branch' : '#false-branch'
      expect(await probe(id).locator(branch).count()).toBe(1)
    }
  })

  it('1128.typed-props', async () => {
    const values = () => probe('variant-probe').locator('#string-value, #number-value, #object-value, #array-value').allTextContents()
    await expect.poll(values).toEqual(['string-initial', '7', 'object-initial', 'array-initial'])
    let calls = 0
    for (const name of ['label', 'total', 'payload', 'items']) {
      await probe('variant-probe').locator(`#call-${name}`).click()
      await expect.poll(() => probe('variant-probe').locator('#last-method').textContent()).toBe(name)
      await expect.poll(() => probe('variant-probe').locator('#variant-handler-count').textContent()).toBe(String(++calls))
    }
    expect(await values()).toEqual(['string-initial', '7', 'object-initial', 'array-initial'])
    await probe('update-variants').click()
    await expect.poll(values).toEqual(['string-updated', '12', 'object-updated', 'array-updated,second'])
    await probe('variant-probe').locator('#call-items').click()
    await expect.poll(() => probe('variant-probe').locator('#variant-handler-count').textContent()).toBe('5')
    expect(await values()).toEqual(['string-updated', '12', 'object-updated', 'array-updated,second'])
  })

  it('1128.projected-commits', async () => {
    const values = () => probe('variant-probe').locator('#object-value, #array-value').allTextContents()
    await expect.poll(values).toEqual(['object-initial', 'array-initial'])
    await probe('commit-same-projection').click()
    await expect.poll(values).toEqual(['object-same-reference', 'array-same-reference'])
    await probe('commit-new-projection').click()
    await expect.poll(values).toEqual(['object-new-wrapper', 'array-new-wrapper'])
    await probe('variant-probe').locator('#call-payload').click()
    await expect.poll(() => probe('variant-probe').locator('#variant-handler-count').textContent()).toBe('1')
    expect(await values()).toEqual(['object-new-wrapper', 'array-new-wrapper'])
  })

  it('1128.function-prop', async () => {
    await probe('variant-probe').locator('#call-callback').click()
    await expect.poll(() => probe('variant-probe').locator('#last-method').textContent()).toBe('callback')
    await expect.poll(() => probe('variant-probe').locator('#variant-handler-count').textContent()).toBe('1')
    expect(await probe('callback-count').textContent()).toBe('0')
    await probe('variant-probe').locator('#call-function-prop').click()
    await expect.poll(() => probe('variant-probe').locator('#function-result').textContent()).toBe('string-initial')
    await expect.poll(() => probe('callback-count').textContent()).toBe('1')
    await probe('update-variants').click()
    await probe('variant-probe').locator('#call-function-prop').click()
    await expect.poll(() => probe('variant-probe').locator('#function-result').textContent()).toBe('string-updated')
    await expect.poll(() => probe('callback-count').textContent()).toBe('2')
    expect(await probe('variant-probe').locator('#variant-handler-count').textContent()).toBe('1')
  })
})
