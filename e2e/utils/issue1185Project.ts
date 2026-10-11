/* eslint-disable e18e/ban-dependencies -- 通过真实 CLI 验证同名 SFC 与脚本的入口身份。 */
import { cp, mkdir, mkdtemp, realpath, symlink } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { sanitizeBuildCommandEnv } from './buildLog'

const ROOT = path.resolve(import.meta.dirname, '../..')

export async function createIssue1185Project() {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-1185-'))
  await cp(path.join(ROOT, 'e2e-apps/github-issues/fixtures/issue-1185'), project, { recursive: true })
  await mkdir(path.join(project, 'node_modules'))
  for (const [name, relative] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']] as const) {
    await symlink(await realpath(path.join(ROOT, relative)), path.join(project, 'node_modules', name), 'junction')
  }
  return project
}

export async function buildIssue1185Project(project: string) {
  return await execa(process.execPath, [
    path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
    'build',
    project,
  ], {
    cwd: ROOT,
    extendEnv: false,
    env: sanitizeBuildCommandEnv(),
  })
}
