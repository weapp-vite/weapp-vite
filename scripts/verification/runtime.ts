import { realpath } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 正式 IDE 验收复用现有受管 runner 和跨平台退出状态。
import { execa } from 'execa'
import { hasVerificationSourceChanges } from './generatedEvidence.ts'

/** 全量真实 IDE 验收只允许同步且干净的主线工作树。 */
export async function fullRuntimeBlock(root: string): Promise<string | undefined> {
  try {
    const git = async (args: string[]) => (await execa('git', args, { cwd: root })).stdout
    const [branch, head, main, trackedChanges, untrackedFiles, commonGitDirectory] = await Promise.all([
      git(['branch', '--show-current']),
      git(['rev-parse', 'HEAD']),
      git(['rev-parse', 'origin/main']),
      git(['status', '--porcelain', '--untracked-files=no']),
      git(['ls-files', '--others', '--exclude-standard', '-z']),
      git(['rev-parse', '--path-format=absolute', '--git-common-dir']),
    ])
    const [actualRoot, primaryRoot] = await Promise.all([realpath(root), realpath(path.dirname(commonGitDirectory.trim()))])
    const dirty = hasVerificationSourceChanges(trackedChanges, untrackedFiles)
    if (branch.trim() !== 'main' || head.trim() !== main.trim() || dirty || actualRoot !== primaryRoot) {
      return '正式真实 IDE 全量验收必须在干净 main 工作树、HEAD == origin/main 时执行；当前只能提供局部证据'
    }
  }
  catch {
    return '无法证明主线工作树和 origin/main 身份，正式真实 IDE 全量验收被阻断'
  }
}

export async function runFullRuntime(root: string): Promise<number> {
  const beforeFetch = await fullRuntimeBlock(root)
  if (beforeFetch) {
    throw new Error(beforeFetch)
  }
  await execa('git', ['fetch', 'origin', 'main'], { cwd: root, stdio: 'inherit' })
  const blocked = await fullRuntimeBlock(root)
  if (blocked) {
    throw new Error(blocked)
  }
  // full-regression 保留 CI、Web 与真实 IDE full 的原始集合和策略。
  const result = await execa('pnpm', ['run', 'e2e:full'], { cwd: root, stdio: 'inherit', reject: false })
  return result.exitCode ?? 1
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runFullRuntime(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'))
    .then(code => process.exitCode = code)
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = 1
    })
}
