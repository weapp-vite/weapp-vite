import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repository = fileURLToPath(new URL('../../', import.meta.url))
export const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')

/** 冻结诊断及实际 AST 源码；绑定二进制另行取摘要，不推断其构建来源。 */
export async function sourceIdentity() {
  const files = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', 'packages/ast/package.json', 'scripts/nativeLoadDiagnostic/tsconfig.json', 'scripts/scriptAnalysisBaseline/diagnostics.ts']
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
  await visit('packages/ast/src')
  await visit('scripts/nativeLoadDiagnostic')
  return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, digest(await readFile(path.join(repository, file)))])))
}
