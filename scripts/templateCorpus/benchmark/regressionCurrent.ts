import type { CorpusFileIdentity } from '../types'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 复用仓库跨平台 Git 进程执行约定。
import { execa } from 'execa'
import { corpusHash } from '../integrity'
import { repositoryRoot } from '../paths'

export async function regressionProductionFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await regressionProductionFiles(file))
    }
    else if (entry.isFile() && !/\.(?:test|spec)\.[^.]+$/.test(entry.name)) {
      files.push(file)
    }
  }
  return files.sort()
}

/** HEAD 与完整生产源码独立绑定，不能以根入口转发文件的哈希代替实现身份。 */
export async function captureRegressionCurrent() {
  const head = (await execa('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot })).stdout.trim()
  const files = [...new Set([
    ...await regressionProductionFiles(path.join(repositoryRoot, 'packages/wxml/src')),
    ...await regressionProductionFiles(path.join(repositoryRoot, 'scripts/templateCorpus/benchmark')),
    ...await regressionProductionFiles(path.join(repositoryRoot, 'scripts/benchmarkWxmlParser')),
    ...['package.json', 'pnpm-lock.yaml', 'packages/wxml/package.json', 'packages/wxml/tsconfig.json', 'packages/wxml/tsdown.config.ts'].map(file => path.join(repositoryRoot, file)),
  ])].sort()
  const identities: CorpusFileIdentity[] = []
  for (const file of files) {
    const bytes = await readFile(file)
    identities.push({ file: path.relative(repositoryRoot, file).replaceAll('\\', '/'), sha256: corpusHash(bytes), bytes: bytes.length })
  }
  return { head, files: identities, sha256: corpusHash(JSON.stringify(identities)), boundary: 'Current HEAD plus all WXML production modules, benchmark implementation modules, package/build configuration and lockfile. Dirty worktree implementations are represented by their actual source hashes; imported consumer closures are additionally recorded from esbuild metafiles.' }
}
