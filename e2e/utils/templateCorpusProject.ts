/* eslint-disable e18e/ban-dependencies -- 验证真实 CLI 的原生模板构建产物。 */
import { cp, mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { sanitizeBuildCommandEnv } from './buildCommandEnv'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const TEMPLATE_CORPUS_FIXTURE = 'e2e-apps/github-issues/fixtures/template-corpus'
export const TEMPLATE_CORPUS_ROUTES = ['/pages/adjacent/index', '/pages/bindings/index'] as const

export async function createTemplateCorpusProject() {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'template-corpus-'))
  try {
    await cp(path.join(ROOT, TEMPLATE_CORPUS_FIXTURE), project, { recursive: true })
    await mkdir(path.join(project, 'node_modules'))
    await symlink(await realpath(path.join(ROOT, 'packages/weapp-vite')), path.join(project, 'node_modules/weapp-vite'), 'junction')
    return project
  }
  catch (error) {
    await rm(project, { recursive: true, force: true })
    throw error
  }
}

export async function buildTemplateCorpusProject(project: string) {
  await execa(process.execPath, [path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'), 'build', project], {
    cwd: ROOT,
    extendEnv: false,
    env: sanitizeBuildCommandEnv(),
  })
}
