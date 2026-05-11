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

describe.sequential('e2e app: github-issues / issue #554', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders default slot content from components with v-for in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-554/index', 'issue-554 loop slot metadata')
      if (!issuePage) {
        throw new Error('Failed to launch issue-554 page')
      }

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('class="issue554-image"')
      expect(renderedWxml).toContain('src="/assets/images/home/goods-1.png"')

      const imageProbe = await issuePage.$('.issue554-image')
      if (!imageProbe) {
        throw new Error('Failed to query issue-554 slot image')
      }
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
