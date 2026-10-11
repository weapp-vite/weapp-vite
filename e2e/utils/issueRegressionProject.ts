/* eslint-disable e18e/ban-dependencies -- 通过真实 CLI 验证 Issue 的 Web 和小程序消费链路。 */
import { cp, mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { sanitizeBuildCommandEnv } from './buildLog'

const ROOT = path.resolve(import.meta.dirname, '../..')

export async function createIssueRegressionProject(issueId: 1126 | 1127 | 1128 | 1172) {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, `issue-${issueId}-`))
  await cp(path.join(ROOT, `e2e-apps/github-issues/fixtures/issue-${issueId}`), project, { recursive: true })
  await mkdir(path.join(project, 'node_modules/@weapp-vite'), { recursive: true })
  for (const [name, relative] of [
    ['weapp-vite', 'packages/weapp-vite'],
    ['wevu', 'packages-runtime/wevu'],
    ['@weapp-vite/web', 'packages-runtime/web'],
  ] as const) {
    await symlink(await realpath(path.join(ROOT, relative)), path.join(project, 'node_modules', name), 'junction')
  }
  return project
}

export async function createCombinedIssueRegressionProject() {
  const project = await createIssueRegressionProject(1126)
  try {
    for (const issueId of [1127, 1128]) {
      const fixture = path.join(ROOT, `e2e-apps/github-issues/fixtures/issue-${issueId}/src`)
      await cp(path.join(fixture, 'pages/index'), path.join(project, `src/pages/issue-${issueId}`), { recursive: true })
      for (const component of await readdir(path.join(fixture, 'components'))) {
        await cp(path.join(fixture, 'components', component), path.join(project, 'src/components', component), {
          recursive: true,
          force: false,
          errorOnExist: true,
        })
      }
    }
    const pages = ['pages/index/index', 'pages/issue-1127/index', 'pages/issue-1128/index']
    const appPath = path.join(project, 'src/app.vue')
    const app = await readFile(appPath, 'utf8')
    await writeFile(appPath, app.replace('\'pages/index/index\'', pages.map(page => `'${page}'`).join(', ')))
    const configPath = path.join(project, 'project.private.config.json')
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      condition: { miniprogram: { list: Array<{ id: number, name: string, pathName: string, query: string }> } }
    }
    config.condition.miniprogram.list = pages.map((page, index) => ({
      id: index,
      name: `issue-${1126 + index}`,
      pathName: page,
      query: '',
    }))
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`)
    return project
  }
  catch (error) {
    await rm(project, { recursive: true, force: true })
    throw error
  }
}

export async function buildIssueRegressionProject(project: string, platform: 'web' | 'weapp' = 'web') {
  return await execa(process.execPath, [
    path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
    'build',
    project,
    '--platform',
    platform,
  ], {
    cwd: ROOT,
    extendEnv: false,
    env: sanitizeBuildCommandEnv(),
  })
}
