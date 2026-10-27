import { describe } from 'vitest'
import { registerGithubIssuesBuildCases } from './githubIssuesBuild/cases'
import { createGithubIssuesBuildCaseContext, registerGithubIssuesBuildLegacyCases } from './githubIssuesBuild/legacy'

describe('e2e app: github-issues (build)', { concurrent: false }, () => {
  const context = createGithubIssuesBuildCaseContext('slotCompilerOff')
  registerGithubIssuesBuildCases(context, 'slotCompilerOff')
  registerGithubIssuesBuildLegacyCases(context, 'slotCompilerOff')
})
