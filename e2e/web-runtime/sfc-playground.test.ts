import type { Browser } from 'playwright'
import type { PreviewServer } from 'vite'
import path from 'node:path'
import { chromium } from 'playwright'
import { build, preview } from 'vite'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

type ListeningPreviewServer = PreviewServer & {
  resolvedUrls: NonNullable<PreviewServer['resolvedUrls']>
}

const configFile = path.resolve(import.meta.dirname, '../../packages-private/sfc-playground/vite.config.ts')
let server: ListeningPreviewServer
let browser: Browser

beforeAll(async () => {
  // Vitest 的 test 环境不能进入发布 bundle，否则 Vue 会注入开发期 HMR 调用。
  vi.stubEnv('NODE_ENV', 'production')
  try {
    await build({ configFile })
  }
  finally {
    vi.unstubAllEnvs()
  }
  // preview 在监听及 URL 解析完成后才返回；本套件只在关闭前读取地址。
  server = await preview({ configFile, preview: { host: '127.0.0.1', port: 0, open: false } }) as ListeningPreviewServer
  browser = await chromium.launch()
})

afterAll(async () => {
  await browser?.close()
  await new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve()
      return
    }
    server.httpServer.close(error => error ? reject(error) : resolve())
  })
})

it.each([
  { preview: 'normal', stallPreview: false },
  { preview: 'pending external resource', stallPreview: true },
])('compiles SFC source in the shipped browser bundle and reports syntax errors ($preview)', async ({ stallPreview }) => {
  const page = await browser.newPage()
  const errors: string[] = []
  let pendingPreviewResources = 0
  let loaded = false
  page.on('pageerror', error => errors.push(error.stack ?? error.message))
  page.on('load', () => {
    loaded = true
  })
  try {
    if (stallPreview) {
      // 保持预览 iframe 的外部脚本挂起，验证本地编译不依赖 CDN 完成加载。
      await page.route('https://cdn.jsdelivr.net/npm/es-module-shims@*/dist/es-module-shims.wasm.js', () => {
        pendingPreviewResources++
      })
    }
    // load 会等待预览 iframe；编译就绪由下面实际输出、报错与恢复断言证明。
    await page.goto(server.resolvedUrls.local[0]!, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-wevu-pane="script"]').click()
    await expect.poll(() => page.locator('.wevu-output-code').textContent()).toContain('visibleItems')
    expect(await page.locator('[data-status]').getAttribute('data-status')).toBe('ready')
    await page.locator('[data-wevu-pane="template"]').click()
    await expect.poll(() => page.locator('.wevu-output-code').textContent()).toContain('wx:if')

    const replaceSource = async (source: string) => {
      await page.locator('.CodeMirror textarea').focus()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.insertText(source)
    }
    await replaceSource('<script setup>const broken =</script><template><view /></template>')
    await expect.poll(() => page.locator('[data-status]').getAttribute('data-status')).toBe('error')
    await replaceSource('<script setup>const message = "browser-regression"; function read() { return message }</script><template><view>{{ read() }}</view></template>')
    await page.locator('[data-wevu-pane="script"]').click()
    await expect.poll(() => page.locator('.wevu-output-code').textContent()).toContain('browser-regression')
    expect(await page.locator('[data-status]').getAttribute('data-status')).toBe('ready')
    if (stallPreview) {
      await expect.poll(() => pendingPreviewResources).toBe(1)
      expect(loaded).toBe(false)
    }
  }
  catch (error) {
    throw new Error(`${String(error)}\nBrowser errors: ${errors.join('\n')}\nPage: ${await page.locator('body').textContent()}`, { cause: error })
  }
  finally {
    await page.close()
  }
})
