export const GITHUB_ISSUES_BUILD_BASELINE_LABEL = 'ci/github-issues.build.test.ts'

/** 每个分组均为独立进程可执行的真实构建任务，标准断言只属于一个分组。 */
export const GITHUB_ISSUES_BUILD_GROUPS = [
  'standard',
  'sourcemap',
  'issue393',
  'issue510',
  'issue547',
  'issue558',
  'issue564',
  'issue595',
  'issue615',
  'issue642',
  'issue724',
  'issue792',
  'issue793',
  'issue826',
  'issue829',
  'issue838',
  'issue845',
  'issue850',
  'issue892',
  'issue910',
  'issue999',
  'issue1013',
  'issue1014',
  'slotCompilerOff',
] as const

export type GithubIssuesBuildGroup = typeof GITHUB_ISSUES_BUILD_GROUPS[number]

export const GITHUB_ISSUES_BUILD_TASK_LABELS = GITHUB_ISSUES_BUILD_GROUPS.map(group => (
  `ci/github-issues.${group}.build.test.ts`
))

export function isGithubIssuesBuildGroup(value: unknown): value is GithubIssuesBuildGroup {
  return (GITHUB_ISSUES_BUILD_GROUPS as readonly unknown[]).includes(value)
}

/** 旧聚合入口与新的独立任务只允许其中一组进入正式发现范围。 */
export function includesGithubIssuesBuildTask(label: string, topology: string) {
  if (label === GITHUB_ISSUES_BUILD_BASELINE_LABEL) {
    return topology !== 'optimized-v2'
  }
  if (GITHUB_ISSUES_BUILD_TASK_LABELS.includes(label)) {
    return topology === 'optimized-v2'
  }
  return true
}
