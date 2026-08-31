import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
} from './github-issues.runtime.shared'

const ISSUE_911_ROUTE = '/pages/issue-911/index'

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
})
