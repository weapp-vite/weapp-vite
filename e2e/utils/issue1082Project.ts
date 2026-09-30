import { cp, mkdir, mkdtemp, realpath, symlink } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
export async function createIssue1082Project() {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-1082-'))
  await cp(path.join(ROOT, 'e2e-apps/github-issues/fixtures/issue-1082-confirmation'), project, { recursive: true })
  await mkdir(path.join(project, 'node_modules'))
  // 避免 Windows 穿过整目录 junction 后再次解析 pnpm 的包链接。
  for (const [name, relative] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']] as const) {
    await symlink(await realpath(path.join(ROOT, relative)), path.join(project, 'node_modules', name), 'junction')
  }
  return project
}
