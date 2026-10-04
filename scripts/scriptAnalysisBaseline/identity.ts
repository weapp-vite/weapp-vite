import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const scriptRepository = fileURLToPath(new URL('../../', import.meta.url))
export const scriptDigest = (value: string) => createHash('sha256').update(value).digest('hex')

/** 对正确性与计时共用的源码边界取摘要，含跨目录进程及顺序工具。 */
export async function scriptSourceIdentity() {
  const files = [
    'pnpm-lock.yaml',
    'scripts/nativeBindingAnalysis/compileScenarios.ts',
    'scripts/nativeBindingAnalysis/orders.ts',
    'scripts/nativeBindingAnalysis/workerProcess.ts',
    'scripts/nativeBindingAnalysis/workerLifecycle.ts',
    'scripts/astMigrationProfile/fixtures.ts',
  ]
  const collect = async (directory: string) => {
    for (const entry of await readdir(path.join(scriptRepository, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        await collect(relative)
      }
      else if (entry.isFile() && entry.name.endsWith('.ts') && !/\.(?:test|spec)\.ts$/.test(entry.name)) {
        files.push(relative)
      }
    }
  }
  await collect('scripts/scriptAnalysisBaseline')
  await collect('packages-runtime/wevu-compiler/src')
  return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, scriptDigest(await readFile(path.join(scriptRepository, file), 'utf8'))])))
}
