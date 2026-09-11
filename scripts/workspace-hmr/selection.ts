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

/** 严格验收必须执行至少一个项目，空清单不能被当作全绿。 */
export function assertWorkspaceHmrSelection(
  projectCount: number,
  failOnError: boolean,
  options?: { allowEmpty?: boolean },
) {
  if (failOnError && projectCount === 0 && !options?.allowEmpty) {
    throw new Error('No workspace HMR projects selected; strict acceptance requires a non-empty run.')
  }
}
