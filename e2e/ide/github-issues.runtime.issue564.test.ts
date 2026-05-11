import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

describe.sequential('e2e app: github-issues / issue #564', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, 60_000)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders native component default content without nested scoped slot components in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-564/index', 'issue-564 native nested scoped slot')
      if (!issuePage) {
        throw new Error('Failed to launch issue-564 page')
      }

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('issue-564-home')
      expect(renderedWxml).toContain('issue-564-user')

      const homeProbe = await issuePage.$('[data-issue564-label="issue-564-home"]')
      if (!homeProbe) {
        throw new Error('Failed to query issue-564 native tabbar item')
      }
      expect((await homeProbe.text()).trim()).toBe('issue-564-home')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
