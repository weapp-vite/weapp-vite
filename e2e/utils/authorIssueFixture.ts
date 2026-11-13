import { cp, mkdir, mkdtemp, readFile, realpath, symlink } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import { sanitizeBuildCommandEnv } from './buildCommandEnv'

const ROOT = path.resolve(import.meta.dirname, '../..')

/** 原样复制作者复现，以本轮已构建的 workspace 包运行原配置。 */
export async function prepareAuthorIssueFixture(fixture: string) {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, `${path.basename(fixture)}-`))
  await cp(path.join(ROOT, fixture), project, { recursive: true })
  await mkdir(path.join(project, 'node_modules'))
  for (const [name, location] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']]) {
    await symlink(await realpath(path.join(ROOT, location)), path.join(project, 'node_modules', name), 'junction')
  }
  return project
}

/** 输出始终由公共 CLI 的 Vite/Rolldown 写出。 */
export async function buildAuthorIssueFixture(project: string, mode: string) {
  const result = await execa(process.execPath, [path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'), 'build', '--mode', mode], {
    cwd: project,
    env: sanitizeBuildCommandEnv(),
    extendEnv: false,
    all: true,
  })
  process.stdout.write(`${result.all}\n`)
  const output = path.join(project, 'dist', mode === 'props' ? '' : mode)
  const config = JSON.parse(await readFile(path.join(output, 'project.config.json'), 'utf8')) as { appid?: string }
  if (config.appid !== 'wx6ffee4673b257014') {
    throw new Error('Author issue fixture must use the repository E2E AppID')
  }
  return output
}

/** 所有注册页面及组件必须具备原生宿主要求的三个入口文件。 */
export async function assertAuthorIssueOutputs(output: string, entries: string[]) {
  for (const entry of entries) {
    for (const extension of ['js', 'json', 'wxml']) {
      if (!(await readFile(path.join(output, `${entry}.${extension}`), 'utf8')).trim()) {
        throw new Error(`Empty issue output: ${entry}.${extension}`)
      }
    }
  }
}
