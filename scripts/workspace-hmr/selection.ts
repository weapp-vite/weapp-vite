/** 逗号分隔的项目筛选按或匹配，保留原有单个子串筛选语义。 */
export function selectWorkspaceHmrProjects<T extends { id: string }>(projects: T[], filter?: string) {
  if (!filter?.trim()) {
    return projects
  }
  const filters = [...new Set(filter.split(',').map(item => item.trim()).filter(Boolean))]
  if (!filters.length) {
    throw new Error('WORKSPACE_HMR_FILTER must contain at least one project filter.')
  }
  return projects.filter(project => filters.some(item => project.id.includes(item)))
}

/** 区分无相关改动的计划跳过与筛选错误导致的空清单。 */
export function resolveWorkspaceHmrSelection<T extends { id: string }>(
  candidates: T[],
  options: { filter?: string, hasRelevantChanges: boolean },
) {
  const projects = selectWorkspaceHmrProjects(candidates, options.filter)
  const status = projects.length
    ? 'selected'
    : !options.hasRelevantChanges && !options.filter?.trim()
        ? 'skipped-no-relevant-changes'
        : 'empty'
  return { projects, status } as const
}

/** 严格验收必须执行项目；只有明确无相关改动的自动选择可以跳过。 */
export function assertWorkspaceHmrSelection(projectCount: number, failOnError: boolean, selectionStatus?: 'selected' | 'empty' | 'skipped-no-relevant-changes') {
  if (failOnError && projectCount === 0 && selectionStatus !== 'skipped-no-relevant-changes') {
    throw new Error('No workspace HMR projects selected; strict acceptance requires a non-empty run.')
  }
}
