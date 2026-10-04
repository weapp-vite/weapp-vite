import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { scriptRepository, scriptSourceIdentity } from '../scriptAnalysisBaseline/identity'

export const repository = scriptRepository
export const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')

/** 冻结组合实验、两套加载器、真实编译器与解析配置，绑定二进制另行核验。 */
export async function optimizedSourceIdentity(): Promise<Record<string, string>> {
  const identity: Record<string, string> = {}
  for (const [filename, hash] of Object.entries(await scriptSourceIdentity())) {
    if (typeof hash !== 'string' || !/^[a-f\d]{64}$/.test(hash)) {
      throw new TypeError('Invalid script source identity')
    }
    identity[filename] = hash
  }
  const files = ['package.json', 'pnpm-workspace.yaml', 'tsconfig.base.json', 'scripts/optimizedCompilerAnalysis/tsconfig.json', 'scripts/astMigrationProfile/cpuSummary.ts']
  const visit = async (directory: string) => {
    for (const entry of await readdir(path.join(repository, directory), { withFileTypes: true })) {
      const filename = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        await visit(filename)
      }
      else if (entry.isFile() && entry.name.endsWith('.ts') && !/\.(?:test|spec)\.ts$/.test(entry.name)) {
        files.push(filename)
      }
    }
  }
  await visit('scripts/nativeBindingAnalysis')
  await visit('scripts/optimizedCompilerAnalysis')
  for (const file of files.sort()) {
    identity[file] = digest(await readFile(path.join(repository, file)))
  }
  return Object.fromEntries(Object.entries(identity).sort(([a], [b]) => a.localeCompare(b)))
}
