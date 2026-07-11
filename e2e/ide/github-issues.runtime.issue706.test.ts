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

  it('uses the app-service Page protocol when the DevTools page-frame channel is unavailable', async (ctx) => {
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

      const startedAt = Date.now()
      const helloElements = await issuePage.$$('.hello', { timeout: 5_000 })
      const hello = await issuePage.$('.hello', { timeout: 5_000 })
      const status = await issuePage.data('probeStatus', { timeout: 5_000 })
      await issuePage.setData({ probeStatus: 'updated' })
      const updatedStatus = await issuePage.data('probeStatus', { timeout: 5_000 })
      const runtime = await issuePage.callMethodWithOptions('_setProbeStatus', { timeout: 5_000 }, 'method')

      expect(helloElements.length).toBeGreaterThan(0)
      expect(hello).not.toBeNull()
      expect(status).toBe('ready')
      expect(updatedStatus).toBe('updated')
      expect(runtime).toMatchObject({ ok: false, status: 'method' })
      expect(Date.now() - startedAt).toBeLessThan(2_000)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
