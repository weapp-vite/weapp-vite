import { exec } from 'tinyexec'

/** 发布验收绑定实际 Git 候选；工作区不干净时不能把运行结果归因于提交 SHA。 */
export async function observeSequenceCandidate(cwd: string, requireClean: boolean) {
  const [revision, status] = await Promise.all([
    exec('git', ['rev-parse', 'HEAD'], { nodeOptions: { cwd }, throwOnError: true }),
    exec('git', ['status', '--porcelain', '--untracked-files=normal'], { nodeOptions: { cwd }, throwOnError: true }),
  ])
  const changes = status.stdout.trim().split(/\r?\n/).filter(Boolean)
  if (requireClean && changes.length) {
    throw new Error('Clean-candidate acceptance requires committed source and no untracked project files')
  }
  return { revision: revision.stdout.trim(), clean: changes.length === 0, changedFileCount: changes.length }
}
