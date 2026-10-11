import { glob, stat } from 'node:fs/promises'
import path from 'node:path'

export interface TypeTestManifest {
  main?: string
  types?: string
  typings?: string
  tsd?: { directory?: string }
}

interface TypeTestOptions {
  files?: string
  typings?: string
}

async function matchingFiles(directory: string, patterns: string[]) {
  const files = new Set<string>()
  for await (const file of glob(patterns, { cwd: directory })) {
    if ((await stat(path.resolve(directory, file))).isFile()) {
      files.add(file.replaceAll('\\', '/'))
    }
  }
  return [...files].sort()
}

/** 按 tsd 实际选择范围查找契约，避免为少量类型测试扫描依赖和构建产物。 */
export async function collectTypeTestFiles(directory: string, manifest: TypeTestManifest, options: TypeTestOptions = {}) {
  if (options.files !== undefined) {
    return matchingFiles(directory, [options.files])
  }

  const typings = options.typings !== undefined
    ? path.basename(options.typings)
    : manifest.types ?? manifest.typings ?? (manifest.main ? `${path.parse(manifest.main).name}.d.ts` : 'index.d.ts')
  // tsd 只替换 .d.ts；.d.mts 必须由调用方的声明文件断言拒绝，不能静默改选测试。
  const candidates = [typings.replace(/\.d\.ts$/, '.test-d.ts'), typings.replace(/\.d\.ts$/, '.test-d.tsx')]
  const colocated = await matchingFiles(directory, candidates)
  if (colocated.length > 0) {
    return colocated
  }
  const testDirectory = manifest.tsd?.directory ?? 'test-d'
  return matchingFiles(directory, [`${testDirectory}/**/*.{ts,tsx}`])
}
