import type { WorkspacePackage } from './types.ts'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

/** 除源码外，也冻结 workspace、任务图与会改变执行语义的配置。 */
export async function fingerprintConfiguration(root: string, packages: WorkspacePackage[]): Promise<string> {
  const files = [
    'package.json',
    'pnpm-workspace.yaml',
    'pnpm-lock.yaml',
    'turbo.json',
    '.npmrc',
    'tsconfig.json',
    'tsconfig.base.json',
    'eslint.config.js',
    'stylelint.config.js',
    'vitest.config.mts',
    'vitest.coverage.ts',
    'vitest.globalSetup.mjs',
    ...packages.flatMap(item => ['package.json', 'turbo.json', 'vitest.config.ts', 'vitest.config.mts', 'tsconfig.json']
      .map(file => `${item.directory}/${file}`)),
  ]
  const contents = await Promise.all([...new Set(files)].sort().map(async (file) => {
    try {
      return [file, await readFile(path.join(root, file), 'utf8')]
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      return [file, null]
    }
  }))
  return createHash('sha256').update(JSON.stringify({ contents, env: { CI: process.env.CI, NODE_ENV: process.env.NODE_ENV } })).digest('hex')
}
