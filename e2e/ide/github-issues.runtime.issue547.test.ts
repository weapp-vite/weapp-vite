import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

describe.sequential('e2e app: github-issues / issue #547', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders nested augmented default slot content in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-547/index', 'issue-547 nested augmented slot')
      if (!issuePage) {
        throw new Error('Failed to launch issue-547 page')
      }

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('issue-547 nested slot image')

      const imageProbe = await issuePage.$('[data-issue547-image="true"]')
      if (!imageProbe) {
        throw new Error('Failed to query issue-547 nested slot image')
      }
      expect((await imageProbe.text()).trim()).toBe('issue-547 nested slot image')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
