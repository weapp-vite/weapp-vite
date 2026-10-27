import { describe } from 'vitest'
import { registerGithubIssuesBuildCases } from './githubIssuesBuild/cases'
import { createGithubIssuesBuildCaseContext, registerGithubIssuesBuildLegacyCases } from './githubIssuesBuild/legacy'

describe('e2e app: github-issues (build)', { concurrent: false }, () => {
  const context = createGithubIssuesBuildCaseContext('issue1014')
  registerGithubIssuesBuildCases(context, 'issue1014')
  registerGithubIssuesBuildLegacyCases(context, 'issue1014')
})
