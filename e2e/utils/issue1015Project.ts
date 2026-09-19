import { cp, mkdir, mkdtemp, realpath, symlink } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const ISSUE_1015_CLI = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')

export async function createIssue1015Project() {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-1015-'))
  await cp(path.join(ROOT, 'e2e-apps/github-issues/fixtures/issue-1015'), project, { recursive: true })
  await cp(path.join(ROOT, 'e2e-apps/github-issues/src/pages/issue-1015'), path.join(project, 'src/pages/issue-1015'), { recursive: true })
  await mkdir(path.join(project, 'node_modules'))
  for (const [name, relative] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']] as const) {
    await symlink(await realpath(path.join(ROOT, relative)), path.join(project, 'node_modules', name), 'junction')
  }
  return project
}
