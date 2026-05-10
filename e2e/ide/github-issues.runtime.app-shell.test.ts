import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

describe.sequential('e2e app: github-issues / app shell runtime', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, 60_000)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #563: renders app.vue shell, page layout, and page content in real DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, '/pages/issue-338/index', 'issue338-page')
      if (!page) {
        throw new Error('Failed to launch issue-338 page')
      }

      const renderedWxml = await readPageWxml(page)
      const appShellIndex = renderedWxml.indexOf('issue-563-app-shell')
      const layoutIndex = renderedWxml.indexOf('issue-380-default-layout')
      const pageContentIndex = renderedWxml.indexOf('issue338-page')

      expect(appShellIndex).toBeGreaterThanOrEqual(0)
      expect(layoutIndex).toBeGreaterThan(appShellIndex)
      expect(pageContentIndex).toBeGreaterThan(layoutIndex)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #563: keeps app.vue shell when page layout is disabled', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, '/pages/issue-448/index', 'issue448-page')
      if (!page) {
        throw new Error('Failed to launch issue-448 page')
      }

      const renderedWxml = await readPageWxml(page)
      expect(renderedWxml).toContain('issue-563-app-shell')
      expect(renderedWxml).toContain('issue448-page')
      expect(renderedWxml).not.toContain('issue-380-default-layout')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
