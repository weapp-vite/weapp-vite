/* eslint-disable e18e/ban-dependencies -- 验证真实 CLI 与组件注册产物。 */
import { cp, mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { sanitizeBuildCommandEnv } from './buildLog'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const ISSUE_1058_FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1058'

export async function createIssue1058Project() {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-1058-'))
  try {
    await cp(path.join(ROOT, ISSUE_1058_FIXTURE), project, { recursive: true })
    await mkdir(path.join(project, 'node_modules'))
    for (const [name, relative] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']] as const) {
      await symlink(await realpath(path.join(ROOT, relative)), path.join(project, 'node_modules', name), 'junction')
    }
    return project
  }
  catch (error) {
    await rm(project, { recursive: true, force: true })
    throw error
  }
}

export async function buildIssue1058Project(project: string) {
  await execa(process.execPath, [path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'), 'build', project], {
    cwd: ROOT,
    extendEnv: false,
    env: sanitizeBuildCommandEnv(),
  })
}
