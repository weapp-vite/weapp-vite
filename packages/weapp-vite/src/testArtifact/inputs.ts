import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const sessionId = randomUUID()
const excludedDirectories = new Set(['.git', '.weapp-vite', 'node_modules'])

export function resolveArtifactOutDir(cwd: string, options: {
  configFile?: string
  mode?: string
  outDir?: string
  projectConfigPath?: string
  skipNpm?: boolean
}, generation = randomUUID()) {
  if (options.outDir) {
    return path.resolve(cwd, options.outDir)
  }
  const key = createHash('sha256').update(JSON.stringify({
    configFile: options.configFile && path.resolve(cwd, options.configFile),
    mode: options.mode ?? 'test',
    projectConfigPath: options.projectConfigPath && path.resolve(cwd, options.projectConfigPath),
    skipNpm: options.skipNpm ?? false,
  })).digest('hex').slice(0, 16)
  return path.join(cwd, '.weapp-vite/test-artifacts', `${process.pid}-${sessionId}`, key, generation)
}

export function projectInputFiles(cwd: string) {
  const configs = ['vite.config', 'weapp-vite.config', 'vitest.config']
    .flatMap(name => ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map(ext => `${name}.${ext}`))
  return [...configs, 'package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'tsconfig.json', 'project.config.json']
    .map(file => path.join(cwd, file))
}

/** 对真实输入及目录成员取内容摘要，覆盖同长度改写、新增路由和删除文件。 */
export async function fingerprintPaths(paths: Iterable<string>, excluded: string[] = []) {
  const hash = createHash('sha256')
  const visited = new Set<string>()
  const ignored = excluded.map(file => path.resolve(file))
  const isIgnored = (file: string) => ignored.some(root => file === root || file.startsWith(`${root}${path.sep}`))
  const visit = async (file: string) => {
    if (isIgnored(file)) {
      return
    }
    hash.update(`${file}\0`)
    try {
      const stat = await fs.stat(file)
      if (stat.isDirectory()) {
        const real = await fs.realpath(file)
        if (visited.has(real)) {
          return
        }
        visited.add(real)
        const entries = await fs.readdir(file, { withFileTypes: true })
        // 解析器可能监听盘符或文件系统根目录；只记录其成员，显式源码依赖仍递归取内容摘要。
        const filesystemRoot = real === path.parse(real).root
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
          const child = path.join(file, entry.name)
          if (!excludedDirectories.has(entry.name) && !isIgnored(child)) {
            if (filesystemRoot) {
              hash.update(`${entry.name}\0`)
            }
            else {
              await visit(child)
            }
          }
        }
      }
      else {
        hash.update(await fs.readFile(file))
      }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      hash.update('missing')
    }
    hash.update('\0')
  }
  for (const file of [...new Set(paths)].sort()) {
    await visit(path.resolve(file))
  }
  return hash.digest('hex')
}
