import { describe, expect, it, vi } from 'vitest'
import { refreshDeepWiki, resultExitCode, runDeepWiki } from '../.github/scripts/refresh-deepwiki/index.mjs'
import { createPageAdapter } from '../.github/scripts/refresh-deepwiki/page.mjs'
import { identityGate, parseIndexStatus, refreshDecision, validateMainSha } from '../.github/scripts/refresh-deepwiki/state.mjs'

const mainSha = 'a'.repeat(40)
const now = Date.UTC(2026, 9, 21)
const index = { text: 'Last indexed: 9 October 2026 (e85305)', href: 'https://github.com/weapp-vite/weapp-vite/commits/e85305ab' }
const publicState = { httpStatus: 200, url: 'https://deepwiki.com/weapp-vite/weapp-vite', title: 'weapp-vite', bodyText: index.text, controls: ['Refresh'], headings: ['weapp-vite'] }

function adapterFixture(states: (Omit<typeof publicState, 'httpStatus'> & { httpStatus: number | null })[] = [publicState]) {
  let calls = 0
  return {
    navigate: vi.fn(async () => {}),
    inspect: vi.fn(async () => states[Math.min(calls++, states.length - 1)]),
    waitForIndex: vi.fn(async (_timeout: number) => index),
    hasOfficialRefreshControl: vi.fn(async () => true),
    clickOfficialRefreshControl: vi.fn(async () => {}),
    waitForRefreshResult: vi.fn(async () => {}),
  }
}

describe('DeepWiki index and refresh policy', () => {
  it('reads the href prefix independently of the six-character display label', () => {
    expect(parseIndexStatus(index)).toEqual({ sha: 'e85305ab', indexedAt: Date.UTC(2026, 9, 9), dateText: '9 October 2026' })
  })

  it.each([
    { ...index, text: 'Unknown index layout' },
    { ...index, text: 'Last indexed: not-a-date (e85305)' },
    { ...index, text: 'Last indexed: 31 February 2026 (e85305)' },
    { ...index, text: 'Last indexed: 9 October 2026 (e85305' },
    { ...index, text: 'Last indexed: 9 October 2026 (e85305) unexpected' },
    { ...index, text: 'Last indexed: 9 October 2026 (a85305)' },
    { ...index, text: 'Last indexed: October 9, 2026 (e85305)' },
    { ...index, href: 'https://github.com/another/project/commits/e85305ab' },
    { ...index, href: 'https://example.test/weapp-vite/weapp-vite/commits/e85305ab' },
    { ...index, href: `${index.href}z` },
    { ...index, href: index.href.replace('https:', 'http:') },
    { ...index, href: index.href.replace('github.com', 'github.com:8443') },
    { ...index, href: index.href.replace('github.com', 'user:password@github.com') },
    { ...index, href: `${index.href}?tracking=ignored` },
    { ...index, href: `${index.href}#fragment` },
    { ...index, href: '' },
    { ...index, href: `${index.href}${'a'.repeat(40)}` },
  ])('rejects malformed or unrelated public index status: %j', (row) => {
    expect(() => parseIndexStatus(row)).toThrow()
  })

  it('preserves exact eight-day and current-SHA no-action boundaries', () => {
    const parsed = parseIndexStatus(index)
    expect(refreshDecision(mainSha, parsed, parsed.indexedAt + 8 * 86_400_000 - 1).status).toBe('not-due')
    expect(refreshDecision(mainSha, parsed, parsed.indexedAt + 8 * 86_400_000).status).toBe('due')
    expect(refreshDecision(`${parsed.sha}${'a'.repeat(32)}`, parsed, now).status).toBe('current')
    expect(validateMainSha(` ${mainSha.toUpperCase()} `)).toBe(mainSha)
    expect(() => validateMainSha('a'.repeat(39))).toThrow('full Git commit SHA')
  })

  it('rejects a future index before refresh and accepts a canonical trailing slash', async () => {
    expect(parseIndexStatus({ ...index, href: `${index.href}/` }, now).sha).toBe('e85305ab')
    expect(() => parseIndexStatus(index, Date.UTC(2026, 9, 8))).toThrow('future')
    const adapter = adapterFixture()
    adapter.waitForIndex.mockResolvedValue({ ...index, text: 'Last indexed: 22 October 2026 (e85305)' })
    expect(await refreshDeepWiki({ adapter, mainSha, now })).toMatchObject({ status: 'failed', reason: expect.stringContaining('future') })
    expect(adapter.clickOfficialRefreshControl).not.toHaveBeenCalled()
  })

  it('does not treat an ordinary navigation sign-in link as a blocking login page', () => {
    expect(identityGate({ ...publicState, bodyText: `Sign in\n${index.text}`, controls: ['Sign in', 'Refresh'] })).toBeUndefined()
  })
})

describe('DeepWiki explicit terminal outcomes', () => {
  it.each([
    { controls: ['Enter email to refresh'], reason: 'email identity' },
    { controls: ['Log in to refresh'], reason: 'login' },
    { title: 'Verify you are human', reason: 'CAPTCHA' },
  ])('stops at $reason without clicking or reporting accepted', async ({ reason, ...state }) => {
    const adapter = adapterFixture([{ ...publicState, ...state }])
    const result = await refreshDeepWiki({ adapter, mainSha, now })
    expect(result).toMatchObject({ status: 'blocked', reason: expect.stringContaining(reason) })
    expect(resultExitCode(result)).toBe(1)
    expect(adapter.clickOfficialRefreshControl).not.toHaveBeenCalled()
    expect(adapter.waitForRefreshResult).not.toHaveBeenCalled()
  })

  it.each([404, 500, null])('fails HTTP %s before reading or acting on index data', async (httpStatus) => {
    const adapter = adapterFixture([{ ...publicState, httpStatus }])
    expect(await refreshDeepWiki({ adapter, mainSha, now })).toMatchObject({ status: 'failed', pageState: { httpStatus } })
    expect(adapter.waitForIndex).not.toHaveBeenCalled()
    expect(adapter.clickOfficialRefreshControl).not.toHaveBeenCalled()
  })

  it('keeps an unknown index timeout as a diagnosed hard failure', async () => {
    const state = { ...publicState, title: 'Unexpected page', bodyText: 'Public page changed' }
    const adapter = adapterFixture([state])
    adapter.waitForIndex.mockRejectedValue(new Error('index wait timed out'))
    const result = await refreshDeepWiki({ adapter, mainSha, now })
    expect(adapter.waitForIndex).toHaveBeenCalledWith(30_000)
    expect(result).toMatchObject({ status: 'failed', pageState: state, error: { message: 'index wait timed out' } })
    expect(resultExitCode(result)).toBe(1)
    expect(adapter.clickOfficialRefreshControl).not.toHaveBeenCalled()
  })

  it.each(['Enter email to refresh', 'Log in to refresh'])('keeps an unknown index as failure despite %s', async (control) => {
    const adapter = adapterFixture([{ ...publicState, controls: [control] }])
    adapter.waitForIndex.mockRejectedValue(new Error('index wait timed out'))
    expect(await refreshDeepWiki({ adapter, mainSha, now })).toMatchObject({ status: 'failed' })
    expect(adapter.clickOfficialRefreshControl).not.toHaveBeenCalled()
  })

  it('stops a login redirect before trusting even current index data', async () => {
    const adapter = adapterFixture([{ ...publicState, url: 'https://deepwiki.com/login' }])
    expect(await refreshDeepWiki({ adapter, mainSha: `${parseIndexStatus(index).sha}${'a'.repeat(32)}`, now })).toMatchObject({ status: 'blocked' })
    expect(adapter.waitForIndex).not.toHaveBeenCalled()
  })

  it('diagnoses a challenge that appears while waiting for index data', async () => {
    const adapter = adapterFixture([publicState, { ...publicState, title: 'Verify you are human' }])
    adapter.waitForIndex.mockRejectedValue(new Error('index wait timed out'))
    expect(await refreshDeepWiki({ adapter, mainSha, now })).toMatchObject({ status: 'blocked', reason: expect.stringContaining('CAPTCHA') })
    expect(adapter.clickOfficialRefreshControl).not.toHaveBeenCalled()
  })

  it('fails missing official controls without falling through into a later click', async () => {
    const adapter = adapterFixture()
    adapter.hasOfficialRefreshControl.mockResolvedValue(false)
    const result = await refreshDeepWiki({ adapter, mainSha, now })
    expect(result).toMatchObject({ status: 'failed', reason: 'The official DeepWiki refresh control is unavailable' })
    expect(adapter.clickOfficialRefreshControl).not.toHaveBeenCalled()
    expect(adapter.waitForRefreshResult).not.toHaveBeenCalled()
  })

  it.each(['Enter email to refresh', 'Log in to refresh'])('preserves current and not-due no-op results with %s', async (control) => {
    const adapter = adapterFixture([{ ...publicState, controls: [control] }])
    const current = `${parseIndexStatus(index).sha}${'a'.repeat(32)}`
    expect(await refreshDeepWiki({ adapter, mainSha: current, now })).toMatchObject({ status: 'current' })
    expect(await refreshDeepWiki({ adapter, mainSha, now: Date.UTC(2026, 9, 16) })).toMatchObject({ status: 'not-due' })
    expect(adapter.clickOfficialRefreshControl).not.toHaveBeenCalled()
  })

  it.each(['Refresh request accepted', 'Refreshing', 'Queued', 'Wait 8 days to refresh'])('accepts official acknowledgement: %s', async (bodyText) => {
    const adapter = adapterFixture([publicState, publicState, { ...publicState, bodyText }])
    const result = await refreshDeepWiki({ adapter, mainSha, now })
    expect(result).toMatchObject({ status: 'accepted' })
    expect(resultExitCode(result)).toBe(0)
    expect(adapter.clickOfficialRefreshControl).toHaveBeenCalledTimes(1)
  })

  it('does not accept queued text on an identity-gated result page', async () => {
    const adapter = adapterFixture([publicState, publicState, { ...publicState, bodyText: 'Queued', controls: ['Enter email to refresh'] }])
    const result = await refreshDeepWiki({ adapter, mainSha, now })
    expect(result.status).toBe('blocked')
    expect(resultExitCode(result)).toBe(1)
    expect(adapter.clickOfficialRefreshControl).toHaveBeenCalledTimes(1)
  })

  it.each([
    { controls: [...Array.from({ length: 127 }, (_, i) => `Navigation ${i}`), 'Enter email to refresh'], reason: 'email identity' },
    { bodyText: `${'x'.repeat(12_001)} Verify you are human`, reason: 'CAPTCHA' },
    { headings: [...Array.from({ length: 51 }, (_, i) => `Section ${i}`), 'Sign in to continue'], reason: 'login' },
  ])('keeps identity policy complete beyond diagnostic limits: $reason', async ({ reason, ...state }) => {
    const adapter = adapterFixture([{ ...publicState, ...state }])
    const result = await refreshDeepWiki({ adapter, mainSha, now })
    expect(result).toMatchObject({ status: 'blocked', reason: expect.stringContaining(reason) })
    expect(adapter.clickOfficialRefreshControl).not.toHaveBeenCalled()
    expect(adapter.hasOfficialRefreshControl).not.toHaveBeenCalled()
  })

  it('checks late identity gates before an early acceptance message after clicking', async () => {
    const controls = [...Array.from({ length: 127 }, (_, i) => `Navigation ${i}`), 'Enter email to refresh']
    const adapter = adapterFixture([publicState, publicState, { ...publicState, controls, bodyText: `Queued ${'x'.repeat(12_001)} Verify you are human` }])
    expect(await refreshDeepWiki({ adapter, mainSha, now })).toMatchObject({ status: 'blocked', reason: expect.stringContaining('CAPTCHA') })
    expect(adapter.clickOfficialRefreshControl).toHaveBeenCalledTimes(1)
  })

  it('recognizes official acknowledgement beyond the diagnostic body limit', async () => {
    const adapter = adapterFixture([publicState, publicState, { ...publicState, bodyText: `${'x'.repeat(12_001)} Refresh request accepted` }])
    expect(await refreshDeepWiki({ adapter, mainSha, now })).toMatchObject({ status: 'accepted' })
    expect(adapter.clickOfficialRefreshControl).toHaveBeenCalledTimes(1)
  })

  it('fails a click without public acceptance and retains the page evidence', async () => {
    const adapter = adapterFixture()
    const result = await refreshDeepWiki({ adapter, mainSha, now })
    expect(result).toMatchObject({ status: 'failed', pageState: publicState })
    expect(resultExitCode(result)).toBe(1)
  })
})

describe('DeepWiki browser ownership', () => {
  it.each(['newPage', 'report'])('closes the owned browser if %s fails', async (failure) => {
    const browser = { newPage: vi.fn(async () => ({})), close: vi.fn(async () => {}) }
    const report = vi.fn(async () => {})
    if (failure === 'newPage') {
      browser.newPage.mockRejectedValue(new Error('page failed'))
    }
    else {
      report.mockRejectedValue(new Error('report failed'))
    }
    await expect(runDeepWiki({ launch: async () => browser, createAdapter: () => adapterFixture(), report, mainSha, now })).rejects.toThrow('failed')
    expect(browser.close).toHaveBeenCalledTimes(1)
  })

  it('preserves the original error when browser cleanup also fails', async () => {
    const browser = {
      newPage: vi.fn(async () => { throw new Error('page failed') }),
      close: vi.fn(async () => { throw new Error('cleanup failed') }),
    }
    await expect(runDeepWiki({ launch: async () => browser, createAdapter: () => adapterFixture(), report: vi.fn(), mainSha, now }))
      .rejects
      .toMatchObject({ message: 'page failed', cleanupError: { message: 'cleanup failed' } })
    expect(browser.close).toHaveBeenCalledTimes(1)
  })

  it('reports blocked once and closes the owned browser', async () => {
    const browser = { newPage: vi.fn(async () => ({})), close: vi.fn(async () => {}) }
    const report = vi.fn(async () => {})
    const result = await runDeepWiki({ launch: async () => browser, createAdapter: () => adapterFixture([{ ...publicState, controls: ['Enter email to refresh'] }]), report, mainSha, now })
    if (!result) {
      throw new Error('Expected a reported DeepWiki result')
    }
    expect(result.status).toBe('blocked')
    expect(report).toHaveBeenCalledTimes(1)
    expect(browser.close).toHaveBeenCalledTimes(1)
  })
})

describe('DeepWiki public-page adapter', () => {
  it('preserves complete visible body, controls, headings and title for policy decisions', async () => {
    const controls = [...Array.from({ length: 127 }, (_, i) => `Navigation ${i}`), 'Enter email to refresh']
    const headings = [...Array.from({ length: 51 }, (_, i) => `Section ${i}`), 'Sign in to continue']
    const bodyText = `${'x'.repeat(12_001)} Verify you are human`
    const title = `${'x'.repeat(501)} CAPTCHA`
    const collection = (values: string[]) => ({ filter: () => ({ allTextContents: async () => values }) })
    const page = {
      locator: () => ({ innerText: async () => bodyText }),
      url: () => publicState.url,
      title: async () => title,
      getByRole: () => ({ ...collection(headings), or: () => collection(controls) }),
    }
    expect(await createPageAdapter(page).inspect()).toEqual({ httpStatus: null, url: publicState.url, title, bodyText, controls, headings })
  })

  it('reads the date and href from the same visible index row', async () => {
    const row = {
      waitFor: vi.fn(async () => {}),
      evaluate: vi.fn(async callback => callback({
        textContent: index.text,
        querySelector: () => ({ getAttribute: () => index.href }),
      })),
    }
    const locator = { filter: vi.fn(() => ({ first: () => row })) }
    const page = { getByText: vi.fn(() => locator) }
    expect(await createPageAdapter(page).waitForIndex(30_000)).toEqual(index)
    expect(locator.filter).toHaveBeenCalledWith({ visible: true })
    expect(row.waitFor).toHaveBeenCalledWith({ timeout: 30_000 })
  })

  it.each(['button', 'link'])('clicks only the available visible official %s control', async (role) => {
    const click = vi.fn(async () => {})
    const page = { getByRole: vi.fn((candidate, { name }) => ({
      filter: ({ visible }: { visible: boolean }) => ({
        count: async () => visible && candidate === role && name.test('Refresh this wiki') ? 1 : 0,
        first: () => ({ click, count: async () => candidate === role ? 1 : 0 }),
      }),
    })) }
    const adapter = createPageAdapter(page)
    expect(await adapter.hasOfficialRefreshControl()).toBe(true)
    await adapter.clickOfficialRefreshControl()
    expect(click).toHaveBeenCalledTimes(1)
    expect(page.getByRole.mock.calls.every(([, { name }]) => !name.test('Enter email to refresh'))).toBe(true)
  })
})
