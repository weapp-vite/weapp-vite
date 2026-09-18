import { cp, mkdir, mkdtemp, symlink } from 'node:fs/promises'
import path from 'node:path'

export const ISSUE_998_ROOT = path.resolve(import.meta.dirname, '../..')
export const ISSUE_998_CLI = path.join(ISSUE_998_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')

export async function createIssue998Project() {
  const parent = path.join(ISSUE_998_ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-998-'))
  await cp(path.join(ISSUE_998_ROOT, 'e2e-apps/github-issues/fixtures/issue-998'), project, { recursive: true })
  await symlink(path.join(ISSUE_998_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template/node_modules'), path.join(project, 'node_modules'), 'junction')
  return project
}
