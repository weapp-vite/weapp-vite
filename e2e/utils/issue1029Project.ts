/* eslint-disable e18e/ban-dependencies -- 通过真实 CLI 验证页面宏与自动路由的消费链路。 */
import { cp, mkdir, mkdtemp, symlink } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { sanitizeBuildCommandEnv } from './buildLog'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const ISSUE_1029_HOME = '/pages/home/index'
export const ISSUE_1029_PROFILE = '/subpackages/account/pages/profile/index'
export const ISSUE_1029_LEGACY = '/pages/legacy/index'

export async function createIssue1029Project() {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-1029-'))
  await cp(path.join(ROOT, 'e2e-apps/github-issues/fixtures/issue-1029'), project, { recursive: true })
  await symlink(path.join(ROOT, 'e2e-apps/github-issues/node_modules'), path.join(project, 'node_modules'), 'junction')
  return project
}

export async function runIssue1029Command(project: string, command: 'build' | 'prepare', args: string[] = []) {
  return await execa(process.execPath, [
    path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
    command,
    project,
    ...args,
  ], {
    cwd: ROOT,
    extendEnv: false,
    env: sanitizeBuildCommandEnv(),
  })
}
