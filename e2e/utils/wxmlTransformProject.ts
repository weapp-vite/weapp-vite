/* eslint-disable e18e/ban-dependencies -- 通过真实 CLI 验证最终模板转换。 */
import { cp, mkdir, mkdtemp, readFile, realpath, rename, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { sanitizeBuildCommandEnv } from './buildLog'

const ROOT = path.resolve(import.meta.dirname, '../..')

export async function createWxmlTransformProject(externalRules = false) {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const temporaryRoot = await mkdtemp(path.join(parent, 'wxml-transform-'))
  const project = externalRules ? path.join(temporaryRoot, 'project') : temporaryRoot
  await cp(path.join(ROOT, 'e2e-apps/github-issues/fixtures/wxml-transform'), project, { recursive: true })
  if (externalRules) {
    await rename(path.join(project, 'transform-rules.json'), path.join(temporaryRoot, 'transform-rules.json'))
    const config = path.join(project, 'weapp-vite.config.ts')
    await writeFile(config, (await readFile(config, 'utf8')).replaceAll('\'transform-rules.json\'', '\'../transform-rules.json\''))
  }
  await mkdir(path.join(project, 'node_modules'))
  for (const [name, relative] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']] as const) {
    await symlink(await realpath(path.join(ROOT, relative)), path.join(project, 'node_modules', name), 'junction')
  }
  return project
}

export async function buildWxmlTransformProject(project: string) {
  return execa(process.execPath, [path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'), 'build', project], {
    cwd: ROOT,
    extendEnv: false,
    env: sanitizeBuildCommandEnv(),
  })
}
