/// <reference types="vite/client" />

import type { GithubIssuesBuildGroup } from '../groups'
import type { GithubIssuesBuildCaseContext, GithubIssuesBuildCaseModule } from './types'
import { isGithubIssuesBuildGroup } from '../groups'

const buildCaseModules = import.meta.glob<GithubIssuesBuildCaseModule>('./issue*.case.ts', {
  eager: true,
})

export function registerGithubIssuesBuildCases(context: GithubIssuesBuildCaseContext, group?: GithubIssuesBuildGroup) {
  const sortedModules = Object.entries(buildCaseModules).sort(([leftPath], [rightPath]) => (
    rightPath.localeCompare(leftPath)
  ))

  for (const [modulePath, buildCaseModule] of sortedModules) {
    if (typeof buildCaseModule.registerGithubIssuesBuildCase !== 'function') {
      throw new TypeError(`${modulePath} must export registerGithubIssuesBuildCase()`)
    }
    if (!isGithubIssuesBuildGroup(buildCaseModule.group)) {
      throw new TypeError(`${modulePath} must declare a valid build group`)
    }
    if (group && buildCaseModule.group !== group) {
      continue
    }
    buildCaseModule.registerGithubIssuesBuildCase(context)
  }
}
