import { describe } from 'vitest'
import { registerGithubIssuesBuildCases } from './githubIssuesBuild/cases'
import {
  createGithubIssuesBuildCaseContext,
  registerGithubIssuesBuildLegacyCases,
} from './githubIssuesBuild/legacy'

describe('e2e app: github-issues (build)', { concurrent: false }, () => {
  registerGithubIssuesBuildCases(createGithubIssuesBuildCaseContext())
  registerGithubIssuesBuildLegacyCases()
})
