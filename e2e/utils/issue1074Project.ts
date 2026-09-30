import { cp, mkdir, mkdtemp, realpath, symlink } from 'node:fs/promises'
import path from 'node:path'

export const ISSUE_1074_ROOT = path.resolve(import.meta.dirname, '../..')
export const ISSUE_1074_CLI = path.join(ISSUE_1074_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')

export async function createIssue1074Project() {
  const parent = path.join(ISSUE_1074_ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-1074-'))
  await cp(path.join(ISSUE_1074_ROOT, 'e2e-apps/github-issues/fixtures/issue-1074'), project, { recursive: true })
  await mkdir(path.join(project, 'node_modules'))
  await symlink(await realpath(path.join(ISSUE_1074_ROOT, 'packages/weapp-vite')), path.join(project, 'node_modules/weapp-vite'), 'junction')
  return project
}
