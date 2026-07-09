import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

describe.sequential('e2e app: github-issues / issue #706', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('keeps Page query and data probes responsive when DevTools Page RPC degrades', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(
        miniProgram,
        '/pages/issue-706/index',
        'issue-706 automator page rpc ready',
        30_000,
        {
          readiness: async (page: any) => {
            const runtime = await page.callMethodWithOptions('_runE2E', {
              timeout: 5_000,
            }).catch(() => undefined)
            return runtime?.ok === true
          },
        },
      )
      if (!issuePage) {
        throw new Error('Failed to launch issue-706 page')
      }

      await issuePage.waitForRendered({
        selector: '.hello',
        timeout: 10_000,
      })

      const helloElements = await issuePage.$$('.hello', { timeout: 5_000 })
      const hello = await issuePage.$('.hello', { timeout: 5_000 })
      const status = await issuePage.data('probeStatus', { timeout: 5_000 })

      expect(helloElements.length).toBeGreaterThan(0)
      expect(hello).not.toBeNull()
      expect(status).toBe('ready')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
