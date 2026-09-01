import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  waitForCurrentPagePath,
} from './github-issues.runtime.shared'

const ISSUE_911_ROUTE = '/pages/issue-911/index'
const ISSUE_911_REDIRECT_ROUTE = `${ISSUE_911_ROUTE}?mode=redirect`
const ISSUE_911_ABORT_ROUTE = `${ISSUE_911_ROUTE}?mode=abort`
const ISSUE_550_ROUTE = '/pages/issue-550/index'
const ISSUE_911_TRACE_STORAGE_KEY = '__weapp_vite_issue_911_trace__'

async function clearIssue911Trace(miniProgram: any) {
  await miniProgram.callWxMethodWithOptions('removeStorageSync', {
    timeout: 2_500,
  }, ISSUE_911_TRACE_STORAGE_KEY).catch(() => {})
}

async function readIssue911Trace(miniProgram: any) {
  return await miniProgram.callWxMethodWithOptions('getStorageSync', {
    timeout: 2_500,
  }, ISSUE_911_TRACE_STORAGE_KEY).catch(() => undefined)
}

describe.sequential('e2e app: github-issues / issue #911', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('waits for the initial async beforeEach guard before mounting', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, ISSUE_911_ROUTE, undefined, 45_000, {
      readiness: async (targetPage) => {
        await targetPage.waitForRendered({ selector: '#issue-911-page', timeout: 5_000 })
        return true
      },
    })

    expect(page).toBeTruthy()
    await expect.poll(
      async () => await page?.callMethodWithOptions('_runE2E', { protocolTimeoutMs: 8_000 }),
      { timeout: 10_000 },
    ).toEqual(['beforeEach:start', 'beforeEach:done', 'mounted'])
  })

  it('waits for an async guard before resolving a redirect and mounting the initial page', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    await clearIssue911Trace(miniProgram)
    await miniProgram.reLaunch(ISSUE_911_REDIRECT_ROUTE).catch(() => {})
    const page = await waitForCurrentPagePath(miniProgram, ISSUE_911_ROUTE, 10_000)
    expect(page).toBeTruthy()
    await expect.poll(
      async () => (await readIssue911Trace(miniProgram))?.trace,
      { timeout: 10_000 },
    ).toEqual([
      'beforeEach:start',
      'beforeEach:done',
      'redirect',
      'beforeEach:start',
      'beforeEach:done',
      'mounted',
    ])
    expect((await readIssue911Trace(miniProgram))?.mode).toBe('redirect-target')
  })

  it('aborts after an async guard without mounting the target page', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    await clearIssue911Trace(miniProgram)
    await miniProgram.reLaunch(ISSUE_911_ABORT_ROUTE).catch(() => {})

    await expect.poll(
      async () => (await readIssue911Trace(miniProgram))?.trace,
      { timeout: 10_000 },
    ).toEqual(['beforeEach:start', 'beforeEach:done'])
    expect((await readIssue911Trace(miniProgram))?.mode).toBe('abort')
  })

  it('does not run the issue guard for a subsequent non-target navigation', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, ISSUE_911_ROUTE, undefined, 45_000, {
      readiness: async (targetPage) => {
        await targetPage.waitForRendered({ selector: '#issue-911-page', timeout: 5_000 })
        return true
      },
    })
    expect(page).toBeTruthy()

    await clearIssue911Trace(miniProgram)
    const nextPage = await relaunchPage(miniProgram, ISSUE_550_ROUTE, undefined, 45_000)
    expect(nextPage).toBeTruthy()
    expect(await waitForCurrentPagePath(miniProgram, ISSUE_550_ROUTE, 8_000)).toBeTruthy()
    expect(['', undefined]).toContain(await readIssue911Trace(miniProgram))
  })
})
