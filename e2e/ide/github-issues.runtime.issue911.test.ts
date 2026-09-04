import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  waitForCurrentPagePath,
} from './github-issues.runtime.shared'

const ISSUE_911_ROUTE = '/pages/issue-911/index'
const ISSUE_911_REDIRECT_ROUTE = `${ISSUE_911_ROUTE}?mode=redirect`
const ISSUE_911_ABORT_ROUTE = `${ISSUE_911_ROUTE}?mode=abort`
const ISSUE_911_NEVER_ROUTE = `${ISSUE_911_ROUTE}?mode=never`
const ISSUE_911_REJECT_ROUTE = `${ISSUE_911_ROUTE}?mode=reject`
const ISSUE_911_LATE_ROUTE = `${ISSUE_911_ROUTE}?mode=late`
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

describe('e2e app: github-issues / issue #911', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const relativePath of [
      'pages/issue-911/index.js',
      'pages/issue-911/index.json',
      'pages/issue-911/index.wxml',
      'pages/issue-550/index.js',
      'pages/issue-550/index.json',
      'pages/issue-550/index.wxml',
    ]) {
      await expect(fs.pathExists(path.join(DIST_ROOT, relativePath))).resolves.toBe(true)
    }
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

  it('mounts after the default timeout when an initial guard never settles', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    await clearIssue911Trace(miniProgram)
    await miniProgram.reLaunch(ISSUE_911_NEVER_ROUTE).catch(() => {})
    const page = await waitForCurrentPagePath(miniProgram, ISSUE_911_ROUTE, 15_000)
    expect(page).toBeTruthy()
    await page?.waitForRendered({ selector: '#issue-911-page', timeout: 3_000 })
    await expect.poll(
      async () => await page?.callMethodWithOptions('_runE2E', { protocolTimeoutMs: 3_000 }),
      { timeout: 12_000 },
    ).toContain('mounted')
  })

  it('settles a rejected initial guard without leaving an unhandled promise gate', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    await clearIssue911Trace(miniProgram)
    await miniProgram.reLaunch(ISSUE_911_REJECT_ROUTE).catch(() => {})
    await expect.poll(
      async () => (await readIssue911Trace(miniProgram))?.trace,
      { timeout: 10_000 },
    ).toEqual(['beforeEach:start', 'beforeEach:done'])
  })

  it('cancels a late guard when the page is replaced quickly', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    await clearIssue911Trace(miniProgram)
    await miniProgram.reLaunch(ISSUE_911_LATE_ROUTE).catch(() => {})
    const latePage = await waitForCurrentPagePath(miniProgram, ISSUE_911_ROUTE, 15_000)
    await latePage?.waitForRendered({ selector: '#issue-911-page', timeout: 12_000 })
    await expect.poll(
      async () => (await readIssue911Trace(miniProgram))?.trace ?? [],
      { timeout: 12_000 },
    ).toContain('mounted')
    await miniProgram.reLaunch(ISSUE_550_ROUTE).catch(() => {})
    expect(await waitForCurrentPagePath(miniProgram, ISSUE_550_ROUTE, 8_000)).toBeTruthy()
    await new Promise(resolve => setTimeout(resolve, 1_000))
    const trace = (await readIssue911Trace(miniProgram))?.trace ?? []
    expect(trace.filter(entry => entry === 'mounted')).toHaveLength(1)
    expect(trace).toContain('unmounted')
    expect(trace.indexOf('unmounted')).toBeGreaterThan(trace.indexOf('mounted'))
  })
})
