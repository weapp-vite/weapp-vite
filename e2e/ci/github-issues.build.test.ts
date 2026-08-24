import { describe } from 'vitest'
import { registerGithubIssuesBuildCases } from './githubIssuesBuild/cases'
import {
  createGithubIssuesBuildCaseContext,
  registerGithubIssuesBuildLegacyCases,
} from './githubIssuesBuild/legacy'

describe.sequential('e2e app: github-issues (build)', () => {
  registerGithubIssuesBuildCases(createGithubIssuesBuildCaseContext())
  registerGithubIssuesBuildLegacyCases()
})
