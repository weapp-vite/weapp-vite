import type { TestContext } from 'vitest'
import { ok as assert } from 'node:assert'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  waitForCurrentPagePath,
} from './github-issues.runtime.shared'
import { GUARD_PLANS, GUARD_RESULT_ROUTE } from './githubIssuesDom/guards'

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

async function prepareGuardCase(ctx: TestContext, dom: ReturnType<typeof createDomAcceptance>) {
  const miniProgram = await getSharedMiniProgram(ctx)
  const resultPage = await relaunchPage(miniProgram, GUARD_RESULT_ROUTE, undefined, 30_000, { readiness: 'route' })
  if (!resultPage) {
    throw new Error('Failed to open issue-911 result page')
  }
  await resultPage.callMethod('resetTrace')
  const activeMiniProgram = await getSharedMiniProgram(ctx)
  await dom.check('baseline', activeMiniProgram, resultPage)
  return activeMiniProgram
}

async function checkGuardResult(miniProgram: any, dom: ReturnType<typeof createDomAcceptance>) {
  const resultPage = await relaunchPage(miniProgram, GUARD_RESULT_ROUTE, undefined, 30_000, { readiness: 'route' })
  if (!resultPage) {
    throw new Error('Failed to open issue-911 result page after guard')
  }
  await dom.check('result', miniProgram, resultPage)
}

describe('e2e app: github-issues / issue #911', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const relativePath of [
      'pages/issue-911/index.js',
      'pages/issue-911/index.json',
      'pages/issue-911/index.wxml',
      'pages/issue-911-result/index.js',
      'pages/issue-911-result/index.json',
      'pages/issue-911-result/index.wxml',
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
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', GUARD_PLANS.default)
    const miniProgram = await prepareGuardCase(ctx, dom)
    const page = await relaunchPage(miniProgram, ISSUE_911_ROUTE, undefined, 45_000, {
      readiness: async (targetPage) => {
        await targetPage.waitForRendered({ selector: '#issue-911-page', timeout: 5_000 })
        return true
      },
    })

    assert(page, 'Expected issue-911 page')
    await expect.poll(
      async () => await page.callMethodWithOptions('_runE2E', { timeout: 8_000 }),
      { timeout: 10_000 },
    ).toEqual(['beforeEach:start', 'beforeEach:done', 'mounted'])
    await dom.check('mounted', await getSharedMiniProgram(ctx), page)
  })

  it('waits for an async guard before resolving a redirect and mounting the initial page', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', GUARD_PLANS.redirect)
    const miniProgram = await prepareGuardCase(ctx, dom)
    await clearIssue911Trace(miniProgram)
    await miniProgram.reLaunch(ISSUE_911_REDIRECT_ROUTE).catch(() => {})
    const page = await waitForCurrentPagePath(miniProgram, ISSUE_911_ROUTE, 10_000)
    assert(page, 'Expected issue-911 redirect target page')
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
    await dom.check('mounted', miniProgram, page)
  })

  it('aborts after an async guard without mounting the target page', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', GUARD_PLANS.abort)
    const miniProgram = await prepareGuardCase(ctx, dom)
    await clearIssue911Trace(miniProgram)
    await miniProgram.reLaunch(ISSUE_911_ABORT_ROUTE).catch(() => {})

    await expect.poll(
      async () => (await readIssue911Trace(miniProgram))?.trace,
      { timeout: 10_000 },
    ).toEqual(['beforeEach:start', 'beforeEach:done'])
    expect((await readIssue911Trace(miniProgram))?.mode).toBe('abort')
    const blockedPage = await waitForCurrentPagePath(miniProgram, ISSUE_911_ROUTE, 8_000)
    assert(blockedPage, 'Expected blocked issue-911 page')
    await dom.check('blocked', miniProgram, blockedPage)
    await checkGuardResult(miniProgram, dom)
  })

  it('does not run the issue guard for a subsequent non-target navigation', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', GUARD_PLANS.subsequent)
    const miniProgram = await prepareGuardCase(ctx, dom)
    const page = await relaunchPage(miniProgram, ISSUE_911_ROUTE, undefined, 45_000, {
      readiness: async (targetPage) => {
        await targetPage.waitForRendered({ selector: '#issue-911-page', timeout: 5_000 })
        return true
      },
    })
    assert(page, 'Expected issue-911 page before navigation')

    await dom.check('mounted', await getSharedMiniProgram(ctx), page)
    await clearIssue911Trace(miniProgram)
    const nextPage = await relaunchPage(miniProgram, ISSUE_550_ROUTE, undefined, 45_000)
    assert(nextPage, 'Expected next page after issue-911 navigation')
    expect(await waitForCurrentPagePath(miniProgram, ISSUE_550_ROUTE, 8_000)).toBeTruthy()
    expect(['', undefined]).toContain(await readIssue911Trace(miniProgram))
    await dom.check('other', await getSharedMiniProgram(ctx), nextPage)
  })

  it('mounts after the default timeout when an initial guard never settles', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', GUARD_PLANS.never)
    const miniProgram = await prepareGuardCase(ctx, dom)
    await clearIssue911Trace(miniProgram)
    await miniProgram.reLaunch(ISSUE_911_NEVER_ROUTE).catch(() => {})
    const page = await waitForCurrentPagePath(miniProgram, ISSUE_911_ROUTE, 15_000)
    assert(page, 'Expected issue-911 page after guard timeout')
    await page?.waitForRendered({ selector: '#issue-911-page', timeout: 3_000 })
    await expect.poll(
      async () => await page.callMethodWithOptions('_runE2E', { timeout: 3_000 }),
      { timeout: 12_000 },
    ).toContain('mounted')
    await dom.check('mounted', miniProgram, page)
  })

  it('settles a rejected initial guard without leaving an unhandled promise gate', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', GUARD_PLANS.reject)
    const miniProgram = await prepareGuardCase(ctx, dom)
    await clearIssue911Trace(miniProgram)
    await miniProgram.reLaunch(ISSUE_911_REJECT_ROUTE).catch(() => {})
    await expect.poll(
      async () => (await readIssue911Trace(miniProgram))?.trace,
      { timeout: 10_000 },
    ).toEqual(['beforeEach:start', 'beforeEach:done'])
    const blockedPage = await waitForCurrentPagePath(miniProgram, ISSUE_911_ROUTE, 8_000)
    assert(blockedPage, 'Expected blocked issue-911 page')
    await dom.check('blocked', miniProgram, blockedPage)
    await checkGuardResult(miniProgram, dom)
  })

  it('cancels a late guard when the page is replaced quickly', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', GUARD_PLANS.late)
    const miniProgram = await prepareGuardCase(ctx, dom)
    await clearIssue911Trace(miniProgram)
    const launch = miniProgram.reLaunch(ISSUE_911_LATE_ROUTE).catch(() => {})
    await expect.poll(
      async () => (await readIssue911Trace(miniProgram))?.trace ?? [],
      { timeout: 5_000 },
    ).toEqual(['beforeEach:start'])
    await miniProgram.reLaunch(ISSUE_550_ROUTE).catch(() => {})
    const replacement = await waitForCurrentPagePath(miniProgram, ISSUE_550_ROUTE, 8_000)
    assert(replacement, 'Expected replacement page after navigation')
    await dom.check('replaced', miniProgram, replacement)
    await launch
    await expect.poll(
      async () => (await readIssue911Trace(miniProgram))?.trace ?? [],
      { timeout: 15_000 },
    ).toEqual(['beforeEach:start', 'beforeEach:done'])
    const trace = (await readIssue911Trace(miniProgram))?.trace ?? []
    expect(trace).not.toContain('mounted')
    await dom.check('settled', miniProgram, replacement)
    await checkGuardResult(miniProgram, dom)
  })
})
