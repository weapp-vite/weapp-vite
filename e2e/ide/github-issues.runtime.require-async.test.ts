import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  callRoutePageMethodWithOptions,
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
} from './github-issues.runtime.shared'

const REQUIRE_ASYNC_ROUTE = '/pages/require-async/index'

async function isRequireAsyncPageReady(miniProgram: any) {
  return Boolean(await miniProgram.evaluate(() => {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const page = pages[pages.length - 1] as any
    return page?.route === 'pages/require-async/index'
      && typeof page?._runE2E === 'function'
  }).catch(() => false))
}

async function callRequireAsyncPageMethod(miniProgram: any, page: any, mode: 'callback' | 'native' | 'promise') {
  if (typeof miniProgram.evaluateWithOptions !== 'function' && typeof miniProgram.evaluate !== 'function') {
    return await page.callMethodWithOptions('_runE2E', {
      timeout: 30_000,
    }, mode)
  }
  return await callRoutePageMethodWithOptions(miniProgram, REQUIRE_ASYNC_ROUTE, '_runE2E', {
    protocolTimeoutMs: 30_000,
    readiness: async (_page, runtimeMiniProgram) => await isRequireAsyncPageReady(runtimeMiniProgram),
    recoveryAttempts: 3,
  }, mode)
}

describe('e2e app: github-issues / require async subpackage modules', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('loads subpackage modules through callback, Promise, and native import APIs', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [
      ['initial', 'ready', 'none', 'none'],
      ['callback', 'loaded', 'callback', 'require-async:callback'],
      ['promise', 'loaded', 'promise', 'require-async:promise'],
      ['native', 'loaded', 'native', 'require-async:native-default:require-async:native-named:require-async:transitive'],
    ].map(([id, status, mode, marker]) => ({
      id: id!,
      route: REQUIRE_ASYNC_ROUTE,
      action: `检查 ${id} 加载步骤在页面显示的实际模块结果`,
      nodes: [
        { selector: '#require-async-status', text: `status: ${status}` },
        { selector: '#require-async-mode', text: `mode: ${mode}` },
        { selector: '#require-async-marker', text: `module: ${marker}` },
      ],
    })))
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, REQUIRE_ASYNC_ROUTE, undefined, 45_000, {
      readiness: async (_page, runtimeMiniProgram) => await isRequireAsyncPageReady(runtimeMiniProgram),
    })
    if (!page) {
      throw new Error('Failed to launch require-async page')
    }
    const activeMiniProgram = await getSharedMiniProgram(ctx)
    await dom.check('initial', activeMiniProgram, page)
    const callbackResult = await callRequireAsyncPageMethod(activeMiniProgram, page, 'callback')
    await dom.check('callback', activeMiniProgram, page)
    const promiseResult = await callRequireAsyncPageMethod(activeMiniProgram, page, 'promise')
    await dom.check('promise', activeMiniProgram, page)
    const nativeResult = await callRequireAsyncPageMethod(activeMiniProgram, page, 'native')
    await dom.check('native', activeMiniProgram, page)

    expect(callbackResult).toEqual({
      marker: 'require-async:callback',
      mode: 'callback',
      ok: true,
    })
    expect(promiseResult).toEqual({
      marker: 'require-async:promise',
      mode: 'promise',
      ok: true,
    })
    expect(nativeResult).toEqual({
      marker: 'require-async:native-default:require-async:native-named:require-async:transitive',
      mode: 'native',
      ok: true,
    })
  })
})
