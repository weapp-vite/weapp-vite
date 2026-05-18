import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  delay,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_581_RENDER_TIMEOUT = 8_000
const ISSUE_581_EXPECTED_ROWS = ['init', '123', '456']

async function waitForIssue581Rows(page: any) {
  const start = Date.now()
  let latestRuntime: any
  let latestWxml = ''

  while (Date.now() - start <= ISSUE_581_RENDER_TIMEOUT) {
    latestRuntime = await page.callMethod('_runE2E')
    latestWxml = await readPageWxml(page)
    if (
      latestRuntime?.loading === false
      && Array.isArray(latestRuntime.rows)
      && ISSUE_581_EXPECTED_ROWS.every((row, index) => latestRuntime.rows[index] === row)
      && ISSUE_581_EXPECTED_ROWS.every(row => latestWxml.includes(`data-issue581-name="${row}"`))
    ) {
      return { runtime: latestRuntime, wxml: latestWxml }
    }

    if (typeof page?.waitFor === 'function') {
      await page.waitFor(220)
    }
    else {
      await delay(220)
    }
  }

  return { runtime: latestRuntime, wxml: latestWxml }
}

describe.sequential('e2e app: github-issues / issue #581', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders reactive array pushes after a sibling setup ref flushes first in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-581/index', 'issue-581 reactive array flush')
      if (!issuePage) {
        throw new Error('Failed to launch issue-581 page')
      }

      const { runtime, wxml } = await waitForIssue581Rows(issuePage)

      expect(runtime).toMatchObject({
        ok: true,
        issue: 581,
        loading: false,
        rows: ISSUE_581_EXPECTED_ROWS,
      })
      expect(wxml).toContain('data-loading="false"')
      for (const row of ISSUE_581_EXPECTED_ROWS) {
        expect(wxml).toContain(`data-issue581-name="${row}"`)
      }
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
