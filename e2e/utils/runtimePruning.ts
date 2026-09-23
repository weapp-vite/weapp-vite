/* eslint-disable e18e/ban-dependencies -- 裁剪回归需要通过真实 CLI 构建消费 fixture。 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'

export const RUNTIME_PRUNING_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/github-issues/fixtures/runtime-pruning')
export const RUNTIME_PRUNING_DIST = path.join(RUNTIME_PRUNING_ROOT, 'dist')
export const RUNTIME_PUBLIC_FACTORY_ROOT = path.resolve(RUNTIME_PRUNING_ROOT, '../runtime-public-factory')

export async function buildRuntimePruning(platform = 'weapp', projectRoot = RUNTIME_PRUNING_ROOT) {
  await execa(process.execPath, [
    path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js'),
    'build',
    projectRoot,
    '--platform',
    platform,
    '--skipNpm',
  ], { cwd: projectRoot, stdio: 'pipe' })
}

export async function readRuntimePruningScripts(root = RUNTIME_PRUNING_DIST): Promise<string> {
  const scripts: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const filename = path.join(root, entry.name)
    if (entry.isDirectory()) {
      scripts.push(await readRuntimePruningScripts(filename))
    }
    else if (/\.m?js$/.test(entry.name)) {
      scripts.push(await readFile(filename, 'utf8'))
    }
  }
  return scripts.join('\n')
}
