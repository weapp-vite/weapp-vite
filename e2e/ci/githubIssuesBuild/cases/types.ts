import type { GithubIssuesBuildGroup } from '../groups'

export interface GithubIssuesBuildCaseContext {
  appRoot: string
  cliPath: string
  distRoot: string
  runStandardBuild: () => Promise<void>
  runSourcemapBuild?: () => Promise<void>
}

export interface GithubIssuesBuildCaseModule {
  group: GithubIssuesBuildGroup
  registerGithubIssuesBuildCase: (context: GithubIssuesBuildCaseContext) => void
}

export interface GithubIssuesLegacyBuildCaseModule extends GithubIssuesBuildCaseModule {
  order: number
}
