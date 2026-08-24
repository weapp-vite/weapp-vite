/// <reference types="vite/client" />

import type { GithubIssuesBuildCaseContext, GithubIssuesBuildCaseModule } from './types'

const buildCaseModules = import.meta.glob<GithubIssuesBuildCaseModule>('./issue*.case.ts', {
  eager: true,
})

export function registerGithubIssuesBuildCases(context: GithubIssuesBuildCaseContext) {
  const sortedModules = Object.entries(buildCaseModules).sort(([leftPath], [rightPath]) => (
    rightPath.localeCompare(leftPath)
  ))

  for (const [modulePath, buildCaseModule] of sortedModules) {
    if (typeof buildCaseModule.registerGithubIssuesBuildCase !== 'function') {
      throw new TypeError(`${modulePath} must export registerGithubIssuesBuildCase()`)
    }
    buildCaseModule.registerGithubIssuesBuildCase(context)
  }
}
