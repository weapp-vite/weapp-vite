export interface GithubIssuesBuildCaseContext {
  appRoot: string
  cliPath: string
  distRoot: string
  runStandardBuild: () => Promise<void>
}

export interface GithubIssuesBuildCaseModule {
  registerGithubIssuesBuildCase: (context: GithubIssuesBuildCaseContext) => void
}
