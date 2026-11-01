import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 用跨平台 Node 子进程执行发布包的真实格式化入口。
import { execa } from 'execa'
import oxfmtPackage from '../../packages/oxfmt/package.json'
import { recommended } from '../../packages/oxfmt/src/index'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const FORMATTING_FIXTURE = 'e2e-apps/github-issues/fixtures/formatting-runtime'
export const FORMATTING_ROUTES = ['/pages/raw/index', '/pages/formatted/index'] as const
const FORMATTER_CLI = path.resolve(ROOT, 'packages/oxfmt', oxfmtPackage.bin['weapp-vite-format'])

/** 通过发布 CLI 组合 Oxfmt 与安全 WXML 适配器，保留原页以比较运行时语义。 */
export async function createFormattingProject() {
  const project = await mkdtemp(path.join(os.tmpdir(), 'formatting-runtime-'))
  try {
    await cp(path.join(ROOT, FORMATTING_FIXTURE), project, { recursive: true })
    await cp(path.join(project, 'pages/raw'), path.join(project, 'pages/formatted'), { recursive: true })
    await writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'formatting-runtime', private: true, type: 'module' }))
    await writeFile(path.join(project, 'pnpm-workspace.yaml'), 'packages: []\n')
    await writeFile(path.join(project, '.oxfmtrc.json'), JSON.stringify(recommended))
    const originalSources = await Promise.all(['wxml', 'wxss'].map(async extension => ({
      extension,
      source: await readFile(path.join(project, `pages/raw/index.${extension}`), 'utf8'),
    })))
    const format = (mode: '--write' | '--check') => execa(process.execPath, [FORMATTER_CLI, '-c', '.oxfmtrc.json', mode, 'pages/formatted'], {
      cwd: project,
      timeout: 30_000,
      env: { NO_COLOR: '1' },
    })
    await format('--write')
    await format('--check')
    for (const { extension, source } of originalSources) {
      const original = await readFile(path.join(project, `pages/raw/index.${extension}`), 'utf8')
      const formatted = await readFile(path.join(project, `pages/formatted/index.${extension}`), 'utf8')
      if (original !== source) {
        throw new Error(`Formatting changed the untouched ${extension} control page`)
      }
      if (original === formatted) {
        throw new Error(`Oxfmt runtime fixture did not format ${extension}`)
      }
    }
    const app = JSON.parse(await readFile(path.join(project, 'app.json'), 'utf8')) as Record<string, unknown>
    app.pages = FORMATTING_ROUTES.map(route => route.slice(1))
    await writeFile(path.join(project, 'app.json'), JSON.stringify(app, null, 2))
    const privateConfig = JSON.parse(await readFile(path.join(project, 'project.private.config.json'), 'utf8')) as Record<string, unknown>
    privateConfig.condition = {
      miniprogram: {
        list: FORMATTING_ROUTES.map(route => ({ name: route.slice(1), pathName: route.slice(1), query: '', launchMode: 'default' })),
      },
    }
    await writeFile(path.join(project, 'project.private.config.json'), JSON.stringify(privateConfig, null, 2))
    return project
  }
  catch (error) {
    await rm(project, { recursive: true, force: true })
    throw error
  }
}

/** 浏览器与 Node runtime 共用实际格式化产物，不维护手写的格式化后快照。 */
export async function readFormattingFiles(project: string): Promise<Array<[string, string]>> {
  const entries = await readdir(project, { withFileTypes: true, recursive: true })
  return Promise.all(entries.filter(entry => entry.isFile()).map(async (entry): Promise<[string, string]> => {
    const file = path.join(entry.parentPath, entry.name)
    return [path.relative(project, file).replaceAll('\\', '/'), await readFile(file, 'utf8')]
  }))
}

/** 生成浏览器测试的完整虚拟文件并释放临时目录。 */
export async function createFormattingFiles(): Promise<Array<[string, string]>> {
  const project = await createFormattingProject()
  try {
    return await readFormattingFiles(project)
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
}
