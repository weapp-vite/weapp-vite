import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
} from './github-issues.runtime.shared'

describe.sequential('github-issues runtime import.meta bindings', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #431: renders supported native wxml import.meta bindings at runtime', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)

    const page = await relaunchPage(
      miniProgram,
      '/pages/issue-431/index',
      undefined,
      20_000,
      {
        readiness: async (page) => {
          await page.waitForRendered({
            selector: '#issue431-page',
            dataset: { e2eIssue: '431' },
            timeout: 2_500,
          })
          return true
        },
      },
    )
    if (!page) {
      throw new Error('Failed to launch issue-431 page')
    }

    const pageWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-431/index.wxml'), 'utf8')

    expect(pageWxml).toContain('data-case="double"')
    expect(pageWxml).toContain('data-case=\'single\'')
    expect(pageWxml).toMatch(/data-template-url=(["'])\{\{['"]\/pages\/issue-431\/index\.wxml['"]\}\}\1/)
    expect(pageWxml).toMatch(/data-template-dir=(["'])\{\{['"]\/pages\/issue-431['"]\}\}\1/)
    expect(pageWxml).toMatch(/data-env-label=(["'])\{\{['"]issue-431 native wxml env replacement['"]\}\}\1/)
    expect(pageWxml).toMatch(/data-env-base=(["'])\{\{['"]https:\/\/static\.example\.com\/issue-431['"]\}\}\1/)
    expect(pageWxml).not.toContain('import.meta.env')
    expect(pageWxml).not.toContain('import.meta.url')
    expect(pageWxml).not.toContain('import.meta.dirname')
  })
})
