import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

async function runRequireAsyncMode(ctx: any, mode: 'callback' | 'native' | 'promise') {
  const miniProgram = await getSharedMiniProgram(ctx)
  try {
    const page = await relaunchPage(miniProgram, REQUIRE_ASYNC_ROUTE, undefined, 45_000, {
      readiness: async (_page, runtimeMiniProgram) => await isRequireAsyncPageReady(runtimeMiniProgram),
    })
    expect(page).toBeTruthy()
    return await callRequireAsyncPageMethod(miniProgram, page, mode)
  }
  finally {
    await closeSharedMiniProgram({ force: true })
  }
}

describe.sequential('e2e app: github-issues / require async subpackage modules', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('loads subpackage modules through callback, Promise, and native import APIs', async (ctx) => {
    const callbackResult = await runRequireAsyncMode(ctx, 'callback')
    const promiseResult = await runRequireAsyncMode(ctx, 'promise')
    const nativeResult = await runRequireAsyncMode(ctx, 'native')

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
