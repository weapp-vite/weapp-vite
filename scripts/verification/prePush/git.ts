// eslint-disable-next-line e18e/ban-dependencies -- hook 与隔离快照需要相同的跨平台 Git 执行器。
import { execa } from 'execa'

/** 移除原生 hook 导出的仓库定位变量，让独立工作树自行定位 Git 数据。 */
export async function clearedGitEnvironment(root: string): Promise<Record<string, undefined>> {
  const { stdout } = await execa('git', ['rev-parse', '--local-env-vars'], { cwd: root })
  const names = stdout.split(/\r?\n/).filter(Boolean)
  if (!names.length || names.some(name => !/^GIT_[A-Z0-9_]+$/.test(name))) {
    throw new Error('Git 仓库环境变量清单无效')
  }
  return Object.fromEntries(names.map(name => [name, undefined]))
}
