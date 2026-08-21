import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const INDEX_VALUE = [
  '__ISSUE_826_UTIL_SHARED__',
  '__ISSUE_826_UTIL_SINGLE__',
  '__ISSUE_826_UTIL_LEAF_A__:__ISSUE_826_UTIL_LEAF_B__',
  '__ISSUE_826_SERVICE_SHARED__',
  '__ISSUE_826_SERVICE_SINGLE__',
  '__ISSUE_826_LOCAL_UNMATCHED__',
].join('|')
const SECOND_VALUE = [
  '__ISSUE_826_UTIL_SHARED__',
  '__ISSUE_826_UTIL_LEAF_A__:__ISSUE_826_UTIL_LEAF_B__',
  '__ISSUE_826_SERVICE_SHARED__',
].join('|')

describe.sequential('e2e app: github-issues / issue #826', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('executes preserved single, shared and barrel modules across page relaunches', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const indexPage = await relaunchPage(
        miniProgram,
        '/pages/issue-826/index',
        INDEX_VALUE,
        30_000,
        { readiness: 'wxml' },
      )
      if (!indexPage) {
        throw new Error('Failed to launch issue-826 index page')
      }
      expect(await indexPage.data('value', { timeout: 5_000 })).toBe(INDEX_VALUE)

      const secondPage = await relaunchPage(
        miniProgram,
        '/pages/issue-826/second',
        SECOND_VALUE,
        30_000,
        { readiness: 'wxml' },
      )
      if (!secondPage) {
        throw new Error('Failed to launch issue-826 second page')
      }
      expect(await secondPage.data('value', { timeout: 5_000 })).toBe(SECOND_VALUE)

      const runtimeErrors = miniProgram?.__weappViteRuntimeLogMeta?.entries
        ?.filter((entry: { level?: string }) => entry.level === 'error' || entry.level === 'exception')
        ?? []
      expect(runtimeErrors).toEqual([])
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
