import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

async function waitForIssue448Runtime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await page.callMethod('_runE2E')
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
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  throw new Error(`Timed out waiting for issue-448 runtime: ${JSON.stringify(lastRuntime, null, 2)}`)
}

async function waitForIssue459Runtime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await page.callMethod('_runE2E')
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
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  throw new Error(`Timed out waiting for issue-459 runtime: ${JSON.stringify(lastRuntime, null, 2)}`)
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

describe.sequential('github-issues runtime web runtime globals', () => {
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

      const runtime = await waitForIssue448Runtime(page)
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

      const runtime = await waitForIssue459Runtime(page)
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
