import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
  waitForCurrentPagePath,
} from './github-issues.runtime.shared'

async function waitForIssue448Runtime(miniProgram: any, page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null
  let lastError: string | null = null
  let lastPage = page

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      lastPage = await waitForCurrentPagePath(miniProgram, '/pages/issue-448/index', 1_000) ?? lastPage
      const runtime = await lastPage.callMethod('_runE2E')
      lastError = null
      lastRuntime = runtime
      if (
        runtime?.encoded === 'QUI='
        && runtime?.decoded === 'AB'
        && runtime?.eventType === 'tick'
        && runtime?.customEventType === 'payload'
        && runtime?.microtaskState === 'flushed'
        && typeof runtime?.duration === 'number'
        && Number.isFinite(runtime.duration)
        && runtime.duration >= 0
        && typeof runtime?.randomBytes === 'string'
      ) {
        return runtime
      }
    }
    catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    try {
      await lastPage.waitFor(220)
    }
    catch {
    }
  }

  const pageWxml = await readPageWxml(lastPage).catch(error => `readPageWxml failed: ${error instanceof Error ? error.message : String(error)}`)
  throw new Error(`Timed out waiting for issue-448 runtime: ${JSON.stringify({ lastRuntime, lastError, pageWxml }, null, 2)}`)
}

async function waitForIssue459Runtime(miniProgram: any, page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null
  let lastError: string | null = null
  let lastPage = page

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      lastPage = await waitForCurrentPagePath(miniProgram, '/pages/issue-459/index', 1_000) ?? lastPage
      const runtime = await lastPage.callMethod('_runE2E')
      lastError = null
      lastRuntime = runtime
      if (
        runtime?.requestUrl === 'https://issue-459.invalid/abc'
        && runtime?.requestHasOwnBody === false
        && runtime?.responseHasOwnBody === false
        && runtime?.responseHasOwnBodyValue === false
        && typeof runtime?.responseKeys === 'string'
        && runtime?.textCodecRoundTrip === 'issue-459'
      ) {
        return runtime
      }
    }
    catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    try {
      await lastPage.waitFor(220)
    }
    catch {
    }
  }

  const pageWxml = await readPageWxml(lastPage).catch(error => `readPageWxml failed: ${error instanceof Error ? error.message : String(error)}`)
  throw new Error(`Timed out waiting for issue-459 runtime: ${JSON.stringify({ lastRuntime, lastError, pageWxml }, null, 2)}`)
}

function expectRandomBytesPayload(randomBytes: string) {
  const segments = randomBytes.split(',')
  expect(segments.length).toBe(4)
  for (const segment of segments) {
    const value = Number(segment)
    expect(Number.isInteger(value), `invalid random byte: ${segment}`).toBe(true)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(255)
  }
}

// 微信开发者工具 2.01.2510290 对 page-only request-globals 非入口 chunk
// 的注册仍不稳定：页面路径已切换成功，但页面实例不注册且 WXML 为空。
// 构建产物仍由 CI build 用例覆盖，这里跳过 IDE runtime 专属兼容缺陷。
describe.sequential.skip('github-issues runtime web runtime globals', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  })

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #448: exposes the next batch of web runtime globals in DevTools runtime', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)

    try {
      const page = await relaunchPage(
        miniProgram,
        '/pages/issue-448/index',
        undefined,
        20_000,
      )
      if (!page) {
        throw new Error('Failed to launch issue-448 page')
      }

      const runtime = await waitForIssue448Runtime(miniProgram, page)
      const pageWxml = await readPageWxml(page)

      expect(runtime.encoded).toBe('QUI=')
      expect(runtime.decoded).toBe('AB')
      expect(runtime.eventType).toBe('tick')
      expect(runtime.customEventType).toBe('payload')
      expect(runtime.microtaskState).toBe('flushed')
      expect(runtime.duration).toBeGreaterThanOrEqual(0)
      expectRandomBytesPayload(runtime.randomBytes)

      expect(pageWxml).toContain('class="issue448-page"')
      expect(pageWxml).toContain('class="issue448-title"')
      expect(pageWxml.match(/class="issue448-line"/g)?.length).toBe(7)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #459: keeps directly imported web-apis polyfills interoperable in DevTools runtime', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)

    try {
      const page = await relaunchPage(
        miniProgram,
        '/pages/issue-459/index',
        undefined,
        20_000,
      )
      if (!page) {
        throw new Error('Failed to launch issue-459 page')
      }

      const runtime = await waitForIssue459Runtime(miniProgram, page)
      const pageWxml = await readPageWxml(page)

      expect(runtime.requestUrl).toBe('https://issue-459.invalid/abc')
      expect(runtime.requestHasOwnBody).toBe(false)
      expect(runtime.responseHasOwnBody).toBe(false)
      expect(runtime.responseHasOwnBodyValue).toBe(false)
      expect(runtime.responseKeys.includes('body')).toBe(false)
      expect(runtime.responseKeys.includes('bodyValue')).toBe(false)
      expect(runtime.textCodecRoundTrip).toBe('issue-459')

      expect(pageWxml).toContain('class="issue459-page"')
      expect(pageWxml).toContain('class="issue459-title"')
      expect(pageWxml.match(/class="issue459-line"/g)?.length).toBe(6)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
