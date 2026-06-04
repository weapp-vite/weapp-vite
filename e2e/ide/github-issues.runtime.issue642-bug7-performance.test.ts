import { afterAll, beforeAll, describe, it } from 'vitest'
import { runIssue642Bug7RuntimeCase } from './github-issues.runtime.issue642-bug7.shared'
import {
  closeSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
} from './github-issues.runtime.shared'

describe.sequential('e2e app: github-issues / issue #642 bug-7 performance mode', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders bug-7 scoped and default slots in performance mode without runtime loops', async (ctx) => {
    await runIssue642Bug7RuntimeCase(ctx)
  })
})
