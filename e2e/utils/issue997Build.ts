/* eslint-disable e18e/ban-dependencies -- 回归通过 execa 启动真实 CLI，覆盖构建前清理。 */
import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { sanitizeBuildCommandEnv } from './buildLog'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const ISSUE_997_OUTPUTS = [
  'dist/app.js',
  'dist/app.json',
  'dist/pages/index/index.js',
  'dist/pages/index/index.json',
  'dist/pages/index/index.wxml',
  'dist-plugin/index.js',
  'dist-plugin/plugin.json',
]

export async function createIssue997Project() {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-997-'))
  await cp(path.join(ROOT, 'e2e-apps/github-issues/fixtures/issue-997'), project, { recursive: true })
  return project
}

export async function buildIssue997(project: string, options: { preserve?: boolean, verify?: boolean, cli?: boolean } = {}) {
  const missing = new Set<string>()
  const sample = () => {
    for (const file of ISSUE_997_OUTPUTS) {
      if (!existsSync(path.join(project, file))) {
        missing.add(file)
      }
    }
  }
  if (options.verify) {
    sample()
  }
  const timer = options.verify ? setInterval(sample, 1) : undefined
  try {
    await execa(process.execPath, [
      path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
      'build',
      project,
      ...(options.cli ? ['--no-emptyOutDir'] : []),
    ], {
      cwd: ROOT,
      extendEnv: false,
      env: {
        ...sanitizeBuildCommandEnv(),
        ISSUE_997_EMPTY: options.preserve ? 'false' : '',
        ISSUE_997_VERIFY_PRESERVED: options.verify ? 'true' : '',
      },
    })
  }
  finally {
    clearInterval(timer)
  }
  if (options.verify) {
    sample()
  }
  return [...missing]
}
