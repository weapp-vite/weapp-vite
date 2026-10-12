import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { redact, runDeepWikiRefresh } from '../.github/scripts/deepwiki/diagnostics.mjs'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('../.github/scripts/deepwiki/index.mjs', () => ({ refreshDeepWiki: refresh }))

const mainSha = 'a'.repeat(40)
const email = 'maintainer+ci@example.invalid'

function createBrowser() {
  const listeners = new Map<string, (value: unknown) => void>()
  const frame = {}
  const locator = { locator: vi.fn(), count: vi.fn().mockResolvedValue(1), first: vi.fn(), isVisible: vi.fn().mockResolvedValue(true) }
  locator.locator.mockReturnValue(locator)
  locator.first.mockReturnValue(locator)
  const page = {
    on: vi.fn((event: string, listener: (value: unknown) => void) => listeners.set(event, listener)),
    mainFrame: vi.fn(() => frame),
    url: vi.fn(() => 'https://deepwiki.com/weapp-vite/weapp-vite'),
    title: vi.fn().mockResolvedValue('weapp-vite'),
    locator: vi.fn(() => locator),
    getByText: vi.fn(() => locator),
    screenshot: vi.fn().mockResolvedValue(undefined),
  }
  const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn().mockResolvedValue(undefined) }
  return { browser, page, locator, listeners, frame, launch: vi.fn().mockResolvedValue(browser) }
}

describe('DeepWiki diagnostic redaction', () => {
  it('redacts raw, differently cased and URL-encoded notification emails', () => {
    for (const value of [email, email.toUpperCase(), encodeURIComponent(email), encodeURIComponent(email).toLowerCase()]) {
      expect(redact(`Error involving ${value}`, email)).toBe('Error involving [redacted]')
    }
    expect(redact('Other contact: another@example.test', email)).toBe('Other contact: [redacted]')
  })

  it('removes URL queries and fragments and masks standalone request parameters', () => {
    expect(redact(`https://deepwiki.com/ada/index_public_repo?email_to_notify=${encodeURIComponent(email)}&recaptcha_token=opaque-secret#private`, email))
      .toBe('https://deepwiki.com/ada/index_public_repo')
    expect(redact('/ada/index_public_repo?recaptcha_token=opaque-secret#private', email)).toBe('/ada/index_public_repo')
    expect(redact('recaptcha_token=opaque-secret email_to_notify=private-value', email)).toBe('[redacted] [redacted]')
    expect(redact(`email_to_notify=${email}`, email)).toBe('[redacted]')
  })

  it.each([
    'recaptcha_token: "secret-token"',
    '{"recaptcha_token":"secret-token"}',
    '\'recaptcha_token\' = \'secret-token\'',
    'recaptcha%5Ftoken=secret-token',
    'email%5Fto%5Fnotify%3A%22secret-token%22',
    '%7B%22recaptcha_token%22%3A%22secret-token%22%7D',
    '%72%65%63%61%70%74%63%68%61%5f%74%6f%6b%65%6e=secret-token',
  ])('masks sensitive assignments in raw and encoded formats: %s', (value) => {
    expect(redact(value)).not.toContain('secret-token')
    expect(redact(value)).toContain('[redacted]')
  })
})

describe('DeepWiki refresh runner', () => {
  let diagnosticsDir: string
  let output: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    diagnosticsDir = await mkdtemp(path.join(os.tmpdir(), 'deepwiki-refresh-'))
    output = vi.fn()
    refresh.mockReset()
    refresh.mockResolvedValue({
      status: 'current',
      index: { sha: 'abcdef12', dateText: '9 October 2026', indexedAt: Date.UTC(2026, 9, 9) },
      ageDays: 3,
    })
  })

  afterEach(async () => {
    await rm(diagnosticsDir, { recursive: true, force: true })
  })

  async function readDiagnostics() {
    return JSON.parse(await readFile(path.join(diagnosticsDir, 'diagnostics.json'), 'utf8')) as {
      result: { status: string, reason?: string, indexedSha?: string }
      navigation: { status?: number, url?: string, title?: string, vercelMitigated?: string }
      refreshResponse?: { status: number, url: string }
      indexProbe?: { labelCount: number, firstLabelVisible: boolean, commitLinkCount: number }
      recentEvents: Array<{ type: string, url?: string, message: string }>
      diagnosticErrors: string[]
    }
  }

  it.each(['current', 'not-due', 'dry-run', 'accepted', 'cooldown'])('reports %s and closes the browser exactly once', async (status) => {
    const session = createBrowser()
    refresh.mockResolvedValue({ status, index: { sha: 'abcdef12', dateText: '9 October 2026' }, ageDays: 3 })
    const result = await runDeepWikiRefresh({
      env: { MAIN_SHA: mainSha, DRY_RUN: 'true' },
      launch: session.launch,
      output,
      diagnosticsDir,
      timeoutMs: 1234,
    })
    expect(result).toMatchObject({ status, indexedSha: 'abcdef12' })
    expect(refresh).toHaveBeenCalledWith(session.page, expect.objectContaining({ mainSha, dryRun: true, email: '', timeoutMs: 1234 }))
    expect(session.browser.close).toHaveBeenCalledTimes(1)
    expect(session.page.screenshot).not.toHaveBeenCalled()
    expect((await readDiagnostics()).result.status).toBe(status)
    expect(output.mock.calls[0][0]).toContain(`- Status: ${status}`)
  })

  it.each([undefined, 'abcdef1', 'g'.repeat(40)])('rejects invalid main SHA %s before launching', async (invalidSha) => {
    const session = createBrowser()
    const result = await runDeepWikiRefresh({ env: { MAIN_SHA: invalidSha }, launch: session.launch, output, diagnosticsDir })
    expect(result).toEqual({ status: 'failed', reason: 'MAIN_SHA must be a full Git commit SHA' })
    expect(session.launch).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    expect((await readDiagnostics()).result.status).toBe('failed')
  })

  it.each(['', '1', 'TRUE'])('rejects invalid dry-run value %s before launching', async (dryRun) => {
    const session = createBrowser()
    const result = await runDeepWikiRefresh({ env: { MAIN_SHA: mainSha, DRY_RUN: dryRun }, launch: session.launch, output, diagnosticsDir })
    expect(result).toEqual({ status: 'failed', reason: 'DRY_RUN must be true or false' })
    expect(session.launch).not.toHaveBeenCalled()
  })

  it('defaults omitted dry-run to false and removes a stale screenshot before a successful run', async () => {
    const session = createBrowser()
    await writeFile(path.join(diagnosticsDir, 'page.png'), 'previous private screenshot')
    await runDeepWikiRefresh({ env: { MAIN_SHA: mainSha }, launch: session.launch, output, diagnosticsDir })
    expect(refresh).toHaveBeenCalledWith(session.page, expect.objectContaining({ dryRun: false }))
    await expect(readFile(path.join(diagnosticsDir, 'page.png'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reports launch failures without throwing a raw stack', async () => {
    const launch = vi.fn().mockRejectedValue(new Error(`Launch failed for ${email}`))
    const result = await runDeepWikiRefresh({ env: { MAIN_SHA: mainSha, DEEPWIKI_REFRESH_EMAIL: email }, launch, output, diagnosticsDir })
    expect(result).toEqual({ status: 'failed', reason: 'Launch failed for [redacted]' })
    expect(output.mock.calls[0][0]).not.toContain(email)
  })

  it('closes the launched browser when creating its page fails', async () => {
    const session = createBrowser()
    session.browser.newPage.mockRejectedValue(new Error('Page creation failed'))
    const result = await runDeepWikiRefresh({ env: { MAIN_SHA: mainSha }, launch: session.launch, output, diagnosticsDir })
    expect(result).toEqual({ status: 'failed', reason: 'Page creation failed' })
    expect(session.browser.close).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('preserves challenge evidence and the first error when browser cleanup also fails', async () => {
    const session = createBrowser()
    session.page.title.mockResolvedValue('Vercel Security Checkpoint')
    session.page.url.mockReturnValue('https://deepwiki.com/weapp-vite/weapp-vite?recaptcha_token=opaque-secret#private')
    session.browser.close.mockRejectedValue(new Error(`Close failed for ${email.toUpperCase()}`))
    refresh.mockImplementation(async () => {
      session.listeners.get('response')?.({
        request: () => ({ isNavigationRequest: () => true, frame: () => session.frame }),
        status: () => 429,
        url: () => session.page.url(),
        headers: () => ({ 'x-vercel-mitigated': 'challenge' }),
      })
      throw Object.assign(new Error(`Vercel challenge for ${email}`), { code: 'VERCEL_SECURITY_CHECKPOINT' })
    })
    const summaryPath = path.join(diagnosticsDir, 'summary.md')
    const result = await runDeepWikiRefresh({
      env: { MAIN_SHA: mainSha, DEEPWIKI_REFRESH_EMAIL: email, GITHUB_STEP_SUMMARY: summaryPath },
      launch: session.launch,
      output,
      diagnosticsDir,
    })
    expect(result).toEqual({ status: 'failed', reason: 'Vercel challenge for [redacted]', code: 'VERCEL_SECURITY_CHECKPOINT' })
    expect(session.browser.close).toHaveBeenCalledTimes(1)
    expect(session.page.screenshot).toHaveBeenCalledWith(expect.objectContaining({ mask: expect.any(Array), fullPage: false }))
    expect(session.page.screenshot.mock.calls[0][0].mask.length).toBeGreaterThanOrEqual(5)
    const diagnostics = await readDiagnostics()
    expect(diagnostics.navigation).toEqual({
      status: 429,
      url: 'https://deepwiki.com/weapp-vite/weapp-vite',
      title: 'Vercel Security Checkpoint',
      vercelMitigated: 'challenge',
    })
    expect(diagnostics.diagnosticErrors).toContain('Close failed for [redacted]')
    for (const artifact of [JSON.stringify(diagnostics), await readFile(summaryPath, 'utf8'), output.mock.calls[0][0]]) {
      expect(artifact).not.toContain(email)
      expect(artifact).not.toContain('opaque-secret')
    }
  })

  it('keeps only the latest ten sanitized browser events', async () => {
    const session = createBrowser()
    refresh.mockImplementation(async () => {
      for (let index = 0; index < 12; index++) {
        session.listeners.get('console')?.({ text: () => `Message ${index}: ${email}` })
      }
      session.listeners.get('requestfailed')?.({
        url: () => 'https://deepwiki.com/ada/index_public_repo?recaptcha_token=opaque-secret',
        failure: () => ({ errorText: `Request rejected for ${encodeURIComponent(email)}` }),
      })
      throw new Error('Refresh failed')
    })
    await runDeepWikiRefresh({ env: { MAIN_SHA: mainSha, DEEPWIKI_REFRESH_EMAIL: email }, launch: session.launch, output, diagnosticsDir })
    const diagnostics = await readDiagnostics()
    expect(diagnostics.recentEvents).toHaveLength(10)
    expect(diagnostics.recentEvents[0].message).toBe('Message 3: [redacted]')
    expect(diagnostics.recentEvents.at(-1)).toEqual({
      type: 'requestfailed',
      url: 'https://deepwiki.com/ada/index_public_repo',
      message: 'Request rejected for [redacted]',
    })
  })

  it('retains a rejected official refresh response separately from successful page navigation', async () => {
    const session = createBrowser()
    refresh.mockImplementation(async () => {
      session.listeners.get('response')?.({
        request: () => ({ isNavigationRequest: () => true, frame: () => session.frame }),
        status: () => 200,
        url: () => session.page.url(),
        headers: () => ({}),
      })
      session.listeners.get('response')?.({
        request: () => ({ isNavigationRequest: () => false, method: () => 'POST' }),
        status: () => 400,
        url: () => `https://api.example.test/ada/index_public_repo?email_to_notify=${encodeURIComponent(email)}&recaptcha_token=secret-token`,
      })
      throw Object.assign(new Error('Official refresh rejected'), { responseStatus: 400 })
    })
    const result = await runDeepWikiRefresh({ env: { MAIN_SHA: mainSha, DEEPWIKI_REFRESH_EMAIL: email }, launch: session.launch, output, diagnosticsDir })
    expect(result).toEqual({ status: 'failed', reason: 'Official refresh rejected', responseStatus: 400 })
    const diagnostics = await readDiagnostics()
    expect(diagnostics.navigation.status).toBe(200)
    expect(diagnostics.refreshResponse).toEqual({ status: 400, url: 'https://api.example.test/ada/index_public_repo' })
    expect(JSON.stringify(diagnostics)).not.toContain('secret-token')
    expect(JSON.stringify(diagnostics)).not.toContain(email)
    expect(output.mock.calls[0][0]).toContain('Page HTTP status: 200')
    expect(output.mock.calls[0][0]).toContain('Official refresh response HTTP status: 400')
  })

  it('records only locator counts and visibility to diagnose hidden first index labels', async () => {
    const session = createBrowser()
    session.locator.count.mockResolvedValue(2)
    session.locator.isVisible.mockResolvedValue(false)
    await runDeepWikiRefresh({ env: { MAIN_SHA: mainSha }, launch: session.launch, output, diagnosticsDir })
    expect((await readDiagnostics()).indexProbe).toEqual({ labelCount: 2, firstLabelVisible: false, commitLinkCount: 2 })
  })

  it('keeps index-probe failure as an auxiliary diagnostic without changing the refresh result', async () => {
    const session = createBrowser()
    session.locator.count.mockRejectedValue(new Error('Index probe unavailable'))
    const result = await runDeepWikiRefresh({ env: { MAIN_SHA: mainSha }, launch: session.launch, output, diagnosticsDir })
    expect(result.status).toBe('current')
    expect((await readDiagnostics()).diagnosticErrors).toContain('Index probe unavailable')
    expect(session.browser.close).toHaveBeenCalledTimes(1)
  })

  it('retains the refresh error and closes the browser when screenshot capture fails', async () => {
    const session = createBrowser()
    refresh.mockRejectedValue(new Error('Refresh failed'))
    session.page.screenshot.mockRejectedValue(new Error('Screenshot failed'))
    const result = await runDeepWikiRefresh({ env: { MAIN_SHA: mainSha }, launch: session.launch, output, diagnosticsDir })
    expect(result).toEqual({ status: 'failed', reason: 'Refresh failed' })
    expect(session.browser.close).toHaveBeenCalledTimes(1)
    expect((await readDiagnostics()).diagnosticErrors).toContain('Screenshot failed')
  })

  it('reports cleanup failure after a successful refresh as failed', async () => {
    const session = createBrowser()
    session.browser.close.mockRejectedValue(new Error('Close failed'))
    const result = await runDeepWikiRefresh({ env: { MAIN_SHA: mainSha }, launch: session.launch, output, diagnosticsDir })
    expect(result).toEqual({ status: 'failed', reason: 'Close failed' })
    expect(session.browser.close).toHaveBeenCalledTimes(1)
    expect((await readDiagnostics()).result.status).toBe('failed')
  })
})
