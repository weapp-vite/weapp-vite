import type { Browser, BrowserContext, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { redact } from './diagnostics.mjs'
import { acceptedText, email, events, fixture, indexedSha, mainSha, now, serve } from './fixtures'
import { refreshDeepWiki } from './index.mjs'
import { parseIndexStatus } from './state.mjs'

let browser: Browser
let context: BrowserContext
let page: Page

beforeAll(async () => {
  browser = await chromium.launch({ headless: true })
})
beforeEach(async () => {
  context = await browser.newContext()
  page = await context.newPage()
})
afterEach(async () => {
  await context?.close()
})
afterAll(async () => {
  await browser?.close()
})

function refresh(options: Record<string, unknown> = {}) {
  return refreshDeepWiki(page, { mainSha, email, now, timeoutMs: 700, ...options })
}

describe('official DeepWiki email refresh form', () => {
  it('opens, fills and submits once after the official button becomes enabled', async () => {
    await serve(page, fixture({ enabledDelay: 150 }))
    expect(await refresh()).toMatchObject({ status: 'accepted', indexedSha, ageDays: 8 })
    expect(await events(page)).toEqual({ opens: 1, inputs: 1, submits: 1 })
    expect(await page.getByRole('status').textContent()).toBe(acceptedText)
  })

  it('waits for a confirmation that arrives later than the old three second sleep', async () => {
    await serve(page, fixture({ delay: 3_200 }))
    expect(await refresh({ timeoutMs: 5_000 })).toMatchObject({ status: 'accepted' })
    expect((await events(page)).submits).toBe(1)
  })

  it('fails without submitting if the Start refresh button remains disabled', async () => {
    await serve(page, fixture({ enabledDelay: 2_000 }))
    await expect(refresh()).rejects.toThrow(/did not become enabled/i)
    expect(await events(page)).toEqual({ opens: 1, inputs: 1, submits: 0 })
  })

  it('fails on the official client console error even if the UI supplies no error', async () => {
    await serve(page, fixture({ outcome: 'console-error' }))
    await expect(refresh()).rejects.toThrow(/official form reported an error/i)
    expect((await events(page)).submits).toBe(1)
  })

  it('fails on a non-OK refresh POST even if the UI supplies no error', async () => {
    await serve(page, fixture({ outcome: 'post-error', delay: 500 }), 200, 503)
    await expect(refresh()).rejects.toThrow(/HTTP 503/i)
    expect((await events(page)).submits).toBe(1)
  })

  it('preserves the HTTP status when the official client logs a later generic error', async () => {
    await serve(page, fixture({ outcome: 'post-error-console', delay: 500 }), 200, 503)
    const consoleError = page.waitForEvent('console', { predicate: message => /Failed to refresh wiki:/i.test(message.text()) })
    const [failure] = await Promise.all([refresh().catch(error => error), consoleError])
    expect(failure).toMatchObject({ responseStatus: 503 })
    expect((await events(page)).submits).toBe(1)
  })

  it('stops immediately when opening the email form changes it to a login restriction', async () => {
    await serve(page, fixture({ openOutcome: 'login' }))
    const startedAt = Date.now()
    await expect(refresh({ timeoutMs: 5_000 })).rejects.toThrow(/login|sign in/i)
    expect(Date.now() - startedAt).toBeLessThan(2_000)
    expect(await events(page)).toEqual({ opens: 1, inputs: 0, submits: 0 })
  })

  it.each([
    ['7 days', '5 October 2026', 'not-due'],
    ['8 days', '4 October 2026', 'accepted'],
  ])('respects the %s boundary', async (_, date, status) => {
    await serve(page, fixture({ date }))
    expect(await refresh()).toMatchObject({ status })
    expect((await events(page)).submits).toBe(status === 'accepted' ? 1 : 0)
  })

  it('does not open the form when the indexed SHA matches main', async () => {
    await serve(page, fixture({ sha: mainSha.slice(0, 7) }))
    expect(await refresh()).toMatchObject({ status: 'current' })
    expect(await events(page)).toEqual({ opens: 0, inputs: 0, submits: 0 })
  })

  it('keeps dry run entirely read only and does not require an email', async () => {
    await serve(page, fixture())
    expect(await refresh({ dryRun: true, email: undefined })).toMatchObject({ status: 'dry-run' })
    expect(await events(page)).toEqual({ opens: 0, inputs: 0, submits: 0 })
  })

  it.each([undefined, '', 'invalid-email'])('rejects a missing or invalid email before submitting (%s)', async (value) => {
    await serve(page, fixture())
    await expect(refresh({ email: value })).rejects.toThrow(/email/i)
    expect(await events(page)).toEqual({ opens: 0, inputs: 0, submits: 0 })
  })

  it('returns cooldown without opening the form for an existing cooldown', async () => {
    await serve(page, fixture({ refresh: '<p>Wait 3 days to refresh</p>' }))
    expect(await refresh()).toMatchObject({ status: 'cooldown' })
    expect(await events(page)).toEqual({ opens: 0, inputs: 0, submits: 0 })
  })

  it('fails when a new cooldown response rejects the request', async () => {
    await serve(page, fixture({ outcome: 'cooldown' }))
    await expect(refresh()).rejects.toThrow(/cooldown/i)
    expect((await events(page)).submits).toBe(1)
  })

  it('ignores queued and login prose in the wiki body', async () => {
    await serve(page, fixture({ body: '<article>Jobs are queued. Sign in to this example app.</article>' }))
    expect(await refresh()).toMatchObject({ status: 'accepted' })
    expect((await events(page)).submits).toBe(1)
  })

  it('uses the official refresh section when the wiki body contains unrelated form controls', async () => {
    const body = '<article><button onclick="window.decoyClicks = (window.decoyClicks || 0) + 1">Enter email to refresh</button><input type="email"><button>Start refresh</button></article>'
    await serve(page, fixture({ body }))
    expect(await refresh()).toMatchObject({ status: 'accepted' })
    expect(await events(page)).toEqual({ opens: 1, inputs: 1, submits: 1 })
    expect(await page.evaluate(() => (window as unknown as { decoyClicks?: number }).decoyClicks ?? 0)).toBe(0)
  })

  it('does not treat an existing success notification as a new confirmation', async () => {
    const body = `<p data-sonner-toast role="status">${acceptedText}</p>`
    await serve(page, fixture({ body, outcome: 'unknown' }))
    await expect(refresh()).rejects.toThrow(/confirm|accepted|timed out|timeout/i)
    expect((await events(page)).submits).toBe(1)
  })

  it('does not accept an unknown response because the wiki body mentions queued', async () => {
    await serve(page, fixture({ body: '<article>A refresh request was accepted and queued in this example.</article>', outcome: 'unknown' }))
    await expect(refresh()).rejects.toThrow(/confirm|accepted|timed out|timeout/i)
    expect((await events(page)).submits).toBe(1)
  })

  it.each(['login', 'captcha'] as const)('fails after a %s response and never submits twice', async (outcome) => {
    await serve(page, fixture({ outcome }))
    await expect(refresh()).rejects.toThrow(/login|sign in|captcha|verification/i)
    expect((await events(page)).submits).toBe(1)
  })

  it('stops at a login restriction before looking for the open button', async () => {
    await serve(page, fixture({ refresh: '<p>Sign in to refresh this wiki</p>' }))
    await expect(refresh()).rejects.toThrow(/login|sign in/i)
    expect((await events(page)).submits).toBe(0)
  })

  it('detects a visible CAPTCHA iframe with no CAPTCHA body text', async () => {
    await serve(page, fixture({ refresh: '<iframe title="reCAPTCHA" src="https://www.google.com/recaptcha/api2/bframe"></iframe>' }))
    await expect(refresh()).rejects.toThrow(/captcha|verification/i)
    expect((await events(page)).submits).toBe(0)
  })

  it('fails on a 429 security checkpoint before index extraction', async () => {
    await serve(page, '<html><head><title>Vercel Security Checkpoint</title></head><body>Verifying your browser</body></html>', 429)
    await expect(refresh()).rejects.toThrow(/429|security|checkpoint|verification/i)
  })

  it('associates a split hidden index label with its own SHA instead of an unrelated link', async () => {
    const index = `<p hidden><span>Last indexed:</span><span>4 October 2026</span>(<a href="https://github.com/weapp-vite/weapp-vite/commits/${indexedSha}">${indexedSha.slice(0, 7)}</a>)</p>`
    await serve(page, fixture({ index, body: `<a href="https://github.com/weapp-vite/weapp-vite/commits/${mainSha}">unrelated commit</a>` }))
    expect(await refresh({ dryRun: true })).toMatchObject({ status: 'dry-run', indexedSha, ageDays: 8 })
  })
})

describe('index parsing and private diagnostic text', () => {
  it('parses the date and abbreviated SHA as one status', () => {
    expect(parseIndexStatus({
      text: 'Last indexed: 4 October 2026 (aaaaaaa)',
      href: 'https://github.com/weapp-vite/weapp-vite/commits/aaaaaaa',
    }, now)).toMatchObject({ indexedSha: 'aaaaaaa', ageDays: 8 })
  })

  it('rejects a malformed date instead of attempting a refresh', () => {
    expect(() => parseIndexStatus({
      text: 'Last indexed: unknown (aaaaaaa)',
      href: 'https://github.com/weapp-vite/weapp-vite/commits/aaaaaaa',
    }, now)).toThrow()
  })

  it.each(['31 February 2026', '13 October 2026'])('rejects an invalid or future date (%s)', (date) => {
    expect(() => parseIndexStatus({
      text: `Last indexed: ${date} (aaaaaaa)`,
      href: 'https://github.com/weapp-vite/weapp-vite/commits/aaaaaaa',
    }, now)).toThrow(/invalid|future/i)
  })

  it('redacts raw and URL encoded email values from diagnostic text', () => {
    const output = redact(`email=${email}; retry=${encodeURIComponent(email)}; ${email.toUpperCase()}`, email)
    expect(output.toLowerCase()).not.toContain(email)
    expect(output.toLowerCase()).not.toContain(encodeURIComponent(email).toLowerCase())
  })
})
