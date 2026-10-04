import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { digest, optimizedSourceIdentity, repository } from '../optimizedCompilerAnalysis/identity'

export { digest, repository }

/** 固定探针、真实编译入口和实验 Rust 源码；二进制另行记录身份。 */
export async function scriptTransformIdentity() {
  const identity = await optimizedSourceIdentity()
  const files = ['scripts/nativeScriptTransform/tsconfig.json', 'packages/ast-native/Cargo.toml', 'packages/ast-native/Cargo.lock']
  const visit = async (directory: string) => {
    for (const entry of await readdir(path.join(repository, directory), { withFileTypes: true })) {
      const filename = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        await visit(filename)
      }
      else if (entry.isFile() && /\.(?:ts|rs)$/.test(filename) && !/\.(?:test|spec)\.ts$/.test(filename)) {
        files.push(filename)
      }
    }
  }
  await visit('scripts/nativeScriptTransform')
  await visit('packages/ast-native/src')
  for (const filename of files.sort()) {
    identity[filename] = digest(await readFile(path.join(repository, filename)))
  }
  return Object.fromEntries(Object.entries(identity).sort(([a], [b]) => a.localeCompare(b)))
}
