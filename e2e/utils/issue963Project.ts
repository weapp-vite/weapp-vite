import { cp, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const ISSUE_963_CLI = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')

/** 从插件模板建立隔离工程，两组配置只切换宿主 ES6 转换。 */
export async function createIssue963Project(es6: boolean) {
  const template = path.join(ROOT, 'templates/weapp-vite-plugin-template')
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-963-'))
  for (const name of ['src', 'plugin', 'shared', 'package.json', 'weapp-vite.config.ts', 'tsconfig.json', 'project.config.json', 'project.private.config.json']) {
    await cp(path.join(template, name), path.join(project, name), { recursive: true })
  }
  await mkdir(path.join(project, 'node_modules'))
  // 避免 Windows 上穿过整目录 junction 后再次解析 pnpm 的包链接。
  const dependencies = {
    'weapp-vite': path.join(ROOT, 'packages/weapp-vite'),
    'wevu': path.join(ROOT, 'packages-runtime/wevu'),
    'dayjs': path.join(template, 'node_modules/dayjs'),
    'sass': path.join(template, 'node_modules/sass'),
  }
  for (const [name, target] of Object.entries(dependencies)) {
    await symlink(await realpath(target), path.join(project, 'node_modules', name), 'junction')
  }
  for (const name of ['project.config.json', 'project.private.config.json']) {
    const file = path.join(project, name)
    const config = JSON.parse(await readFile(file, 'utf8')) as {
      libVersion?: string
      setting?: Record<string, unknown>
      condition?: Record<string, unknown>
    }
    config.libVersion = '3.17.3'
    config.setting = { ...config.setting, es6 }
    if (name === 'project.private.config.json') {
      config.condition = {
        ...config.condition,
        miniprogram: {
          list: [{ name: 'issue-963-host', pathName: 'pages/index/index', query: '', launchMode: 'default' }],
        },
      }
    }
    await writeFile(file, `${JSON.stringify(config, null, 2)}\n`)
  }
  return project
}
