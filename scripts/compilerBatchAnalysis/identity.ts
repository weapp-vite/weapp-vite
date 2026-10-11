import { readdir, readFile, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { hash } from './outcome'

/** 覆盖生产编译器、实际消费的 AST dist、工具源码和锁文件；不声称冻结所有安装的传递依赖。 */
export async function captureIdentity(root: string, nativePath: string) {
  const compilerRequire = createRequire(path.join(root, 'packages-runtime/wevu-compiler/src/index.ts'))
  if (await realpath(compilerRequire.resolve('@weapp-vite/ast/package.json')) !== await realpath(path.join(root, 'packages/ast/package.json'))) {
    throw new Error('Compiler resolves AST outside the measured checkout')
  }
  const trees = [
    'packages-runtime/wevu-compiler/src',
    'packages/ast/src',
    'packages/ast/dist',
    'packages/ast-native/src',
    '@weapp-core/constants/src',
    '@weapp-core/constants/dist',
    '@weapp-core/shared/src',
    '@weapp-core/shared/dist',
    'scripts/compilerBatchAnalysis',
    'scripts/astMigrationProfile',
  ]
  const sourceHashes: Record<string, string> = {}
  const walk = async (relative: string) => {
    for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const filename = `${relative}/${item.name}`
      if (item.isDirectory()) {
        await walk(filename)
      }
      else if (item.isFile() && !/\.(?:test|spec)\.ts$/.test(item.name)) {
        sourceHashes[filename] = hash(await readFile(path.join(root, filename)))
      }
    }
  }
  for (const tree of trees) {
    await walk(tree)
  }
  for (const filename of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'packages/ast-native/index.js', 'packages/ast-native/Cargo.lock', 'scripts/nativeScriptTransform/captureSerialize.ts']) {
    sourceHashes[filename] = hash(await readFile(path.join(root, filename)))
  }
  const addonHashes: Record<string, string> = { [path.basename(nativePath)]: hash(await readFile(nativePath)) }
  for (const file of (await readdir(path.dirname(nativePath))).filter(file => file.endsWith('.node')).sort()) {
    addonHashes[file] = hash(await readFile(path.join(path.dirname(nativePath), file)))
  }
  const sortedSources = Object.fromEntries(Object.entries(sourceHashes).sort(([left], [right]) => left.localeCompare(right)))
  return { sourceHashes: sortedSources, sourceTreeSha256: hash(JSON.stringify(sortedSources)), addonHashes, addonSha256: hash(JSON.stringify(addonHashes)) }
}
