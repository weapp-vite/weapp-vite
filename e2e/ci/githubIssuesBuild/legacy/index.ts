/// <reference types="vite/client" />

import type { GithubIssuesBuildCaseContext, GithubIssuesLegacyBuildCaseModule } from '../cases/types'
import type { GithubIssuesBuildGroup } from '../groups'
import { isGithubIssuesBuildGroup } from '../groups'

export { createGithubIssuesBuildCaseContext } from './context'

const modules = import.meta.glob<GithubIssuesLegacyBuildCaseModule>('./cases/*.case.ts', { eager: true })

/** 历史入口维持原注册次序，独立入口只注册所属分组，断言实现共用同一来源。 */
export function registerGithubIssuesBuildLegacyCases(context: GithubIssuesBuildCaseContext, group?: GithubIssuesBuildGroup) {
  const cases = Object.entries(modules).sort(([, left], [, right]) => left.order - right.order)
  const orders = new Set<number>()
  for (const [modulePath, module] of cases) {
    if (!isGithubIssuesBuildGroup(module.group) || typeof module.registerGithubIssuesBuildCase !== 'function'
      || !Number.isSafeInteger(module.order) || orders.has(module.order)) {
      throw new TypeError(`${modulePath} has invalid or duplicate build-case registration`)
    }
    orders.add(module.order)
    if (!group || module.group === group) {
      module.registerGithubIssuesBuildCase(context)
    }
  }
}
