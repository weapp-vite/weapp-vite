import type { Browser } from 'playwright'
import type { PreviewServer } from 'vite'
import process from 'node:process'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildRuntimePruning, RUNTIME_PRUNING_ROOT } from '../utils/runtimePruning'

describe('issue #1064: pruned Web production runtime', { concurrent: false }, () => {
  let browser: Browser | undefined
  let server: PreviewServer | undefined

  beforeAll(async () => {
    await buildRuntimePruning('web')
    server = await preview({
      root: RUNTIME_PRUNING_ROOT,
      configFile: false,
      build: { outDir: 'dist/web' },
      preview: { host: '127.0.0.1', port: 0, open: false },
    })
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  afterAll(async () => {
    await browser?.close()
    if (server) {
      await new Promise<void>((resolve, reject) => server!.httpServer.close(error => error ? reject(error) : resolve()))
    }
  })

  it('mounts, updates component props and navigates through the Web bridge', async () => {
    const page = await browser!.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(server!.resolvedUrls.local[0]!)
      const active = page.locator('[data-weapp-page-active="true"]')
      await expect.poll(() => active.locator('#pruning-phase').textContent()).toBe('mounted')
      expect(await active.locator('#pruning-platform').textContent()).toBe('web')
      await active.locator('#pruning-increment').click()
      await expect.poll(() => active.locator('#pruning-count').textContent()).toBe('1')
      await expect.poll(() => active.locator('#pruning-child-value').textContent()).toBe('1')
      expect(await active.locator('#pruning-doubled').textContent()).toBe('2')
      await page.evaluate(() => {
        const host = globalThis as unknown as { wx: { reLaunch: (options: { url: string }) => void } }
        host.wx.reLaunch({ url: '/detail/index' })
      })
      await expect.poll(() => active.locator('#pruning-detail').textContent()).toBe('mounted')
      expect(errors).toEqual([])
    }
    finally {
      await page.close()
    }
  })
})
