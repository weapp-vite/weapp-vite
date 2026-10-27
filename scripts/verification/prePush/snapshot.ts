import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 使用跨平台执行器准备独立依赖，禁止借用 dirty workspace 链接。
import { execa } from 'execa'
import { hasCandidateDependencies } from './dependencies.ts'

export interface SnapshotOptions {
  root: string
  head: string
  env: Record<string, string | undefined>
  signal?: AbortSignal
  install?: (directory: string) => Promise<void>
  dependenciesReady?: (directory: string) => Promise<boolean>
}

/** 仅 clean 且身份相符时借用当前工作树；否则创建、安装并回收本任务快照。 */
export async function withPushSnapshot<T>(options: SnapshotOptions, work: (directory: string) => Promise<T>): Promise<T> {
  const { root, head, env, signal } = options
  const git = (args: string[], cwd = root, cancelSignal = signal) => execa('git', args, { cwd, env, cancelSignal })
  const [current, status] = await Promise.all([
    git(['rev-parse', 'HEAD']),
    git(['status', '--porcelain', '--untracked-files=normal']),
  ])
  if (current.stdout.trim() === head && !status.stdout && await (options.dependenciesReady ?? hasCandidateDependencies)(root)) {
    return work(root)
  }
  const parent = path.join(root, '.tmp/verification/pre-push/checkouts')
  await mkdir(parent, { recursive: true })
  const owned = await realpath(await mkdtemp(path.join(parent, 'candidate-')))
  const directory = path.join(owned, 'workspace')
  let attached = false
  const failures: unknown[] = []
  let result!: T
  try {
    await git(['worktree', 'add', '--detach', directory, head])
    attached = true
    if (options.install) {
      await options.install(directory)
    }
    else {
      await execa('pnpm', ['install', '--frozen-lockfile'], { cwd: directory, env: { ...env, INIT_CWD: directory, PNPM_SCRIPT_SRC_DIR: undefined }, stdio: 'inherit', cancelSignal: signal })
    }
    if ((await git(['status', '--porcelain', '--untracked-files=normal'], directory)).stdout) {
      throw new Error('冻结依赖安装修改了候选快照，不能作为待推提交验证')
    }
    result = await work(directory)
  }
  catch (error) {
    failures.push(error)
  }
  try {
    // 取消后仍完成本任务 checkout 的定向清理，不传播已取消的 signal。
    const inventory = await execa('git', ['worktree', 'list', '--porcelain', '-z'], { cwd: root, env })
    const registered = inventory.stdout.split('\0').some(field => field.startsWith('worktree ') && path.resolve(field.slice(9)) === directory)
    if (attached || registered) {
      await execa('git', ['worktree', 'remove', '--force', directory], { cwd: root, env })
    }
    await rm(owned, { recursive: true, force: true })
  }
  catch (error) {
    failures.push(error)
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, '候选验证失败，且本任务隔离快照清理未完成')
  }
  if (failures.length) {
    throw failures[0]
  }
  return result
}
