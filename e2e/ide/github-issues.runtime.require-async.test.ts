import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  callRoutePageMethodWithOptions,
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const REQUIRE_ASYNC_ROUTE = '/pages/require-async/index'

describe.sequential('e2e app: github-issues / require async subpackage modules', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('loads subpackage modules through callback and Promise APIs', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, REQUIRE_ASYNC_ROUTE, undefined, 45_000, {
        readiness: 'route',
      })
      expect(page).toBeTruthy()

      const callbackResult = await callRoutePageMethodWithOptions(miniProgram, REQUIRE_ASYNC_ROUTE, '_runE2E', {
        protocolTimeoutMs: 30_000,
      }, 'callback')
      const promiseResult = await callRoutePageMethodWithOptions(miniProgram, REQUIRE_ASYNC_ROUTE, '_runE2E', {
        protocolTimeoutMs: 30_000,
      }, 'promise')

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
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
