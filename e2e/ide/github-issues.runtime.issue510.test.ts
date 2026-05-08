import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

describe.sequential('e2e app: github-issues / issue #510', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, 60_000)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('preserves provide/inject scope through augmented default slots in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-510/index', 'issue-510 augmented slot provide inject')
      if (!issuePage) {
        throw new Error('Failed to launch issue-510 page')
      }

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('issue-510 inject = issue-510-provider')

      const leaf = await issuePage.$('[data-issue510-leaf="true"]')
      if (!leaf) {
        throw new Error('Failed to query issue-510 slot leaf')
      }
      expect((await leaf.text()).trim()).toBe('issue-510 inject = issue-510-provider')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
