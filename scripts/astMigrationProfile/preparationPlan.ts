import type { ProfileCase } from './types'
import path from 'node:path'

export interface PreparationCommand {
  phase: 'native' | 'closure' | 'project-support'
  command: 'pnpm' | 'node'
  args: string[]
  cwd: string
}

export function uniqueProfileProjects(cases: readonly ProfileCase[]) {
  const projects = new Map<string, { project: string, config: string }>()
  for (const fixture of cases) {
    const existing = projects.get(fixture.project)
    if (existing && existing.config !== fixture.config) {
      throw new Error(`Conflicting project config: ${fixture.project}`)
    }
    projects.set(fixture.project, { project: fixture.project, config: fixture.config })
  }
  return [...projects.values()]
}

/** 回执中的 cwd 与 CLI 参数均为仓库相对路径，实际执行仍使用当前 Node。 */
export function createPreparationPlan(cases: readonly ProfileCase[]): PreparationCommand[] {
  return [
    { phase: 'native', command: 'pnpm', args: ['--filter', '@weapp-vite/ast-native', 'native:build', '--', '--locked'], cwd: '.' },
    { phase: 'closure', command: 'pnpm', args: ['exec', 'turbo', 'run', 'build', '--filter=weapp-vite...', '--filter=@wevu/compiler...', '--force', '--concurrency=1'], cwd: '.' },
    ...uniqueProfileProjects(cases).map(({ project, config }): PreparationCommand => ({
      phase: 'project-support',
      command: 'node',
      args: [path.posix.relative(project, 'packages/weapp-vite/dist/cli.mjs'), 'prepare', '--config', config, '--platform', 'weapp'],
      cwd: project,
    })),
  ]
}

/** prepare 为安装期容错命令，退出零不能证明支持文件同步成功。 */
export function assertProjectPreparation(command: PreparationCommand, stdout: string, stderr: string) {
  if (command.phase !== 'project-support') {
    return
  }
  const output = `${stdout}\n${stderr}`
  if (output.includes('跳过 .weapp-vite 支持文件预生成') || !output.includes('已生成 .weapp-vite 支持文件。')) {
    throw new Error(`Built CLI project preparation did not complete: ${command.cwd}`)
  }
}
