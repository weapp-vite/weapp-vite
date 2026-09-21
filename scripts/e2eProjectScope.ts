import process from 'node:process'

export const EXCLUDED_PROJECTS_ENV = 'WEAPP_VITE_E2E_EXCLUDE_PROJECTS'

/** 读取显式排除的专项项目名；子进程继承相同环境变量。 */
export function excludedE2EProjects(value = process.env[EXCLUDED_PROJECTS_ENV]): string[] {
  const projects = [...new Set((value ?? '').split(',').map(item => item.trim()).filter(Boolean))]
  for (const project of projects) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project)) {
      throw new Error(`${EXCLUDED_PROJECTS_ENV}: invalid project name ${project}`)
    }
  }
  return projects
}

/** 仅匹配项目目录或专项测试文件，不排除通用编译器与运行时测试。 */
export function isExcludedE2EProject(label: string, projects = excludedE2EProjects()) {
  return label.replaceAll('\\', '/').split('/').some(segment =>
    projects.some(project => segment === project || segment.startsWith(`${project}.`)),
  )
}

/** 为直接调用 Vitest 的入口提供与 suite 一致的专项排除规则。 */
export function excludedE2ETestPatterns() {
  return excludedE2EProjects().flatMap(project => [`**/${project}/**`, `**/${project}.test.ts`, `**/${project}.*.test.ts`])
}
