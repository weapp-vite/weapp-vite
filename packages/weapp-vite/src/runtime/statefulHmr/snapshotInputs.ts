import { createHash } from 'node:crypto'
import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

export interface SnapshotInputScope {
  roots: string[]
  files: string[]
  excluded: string[]
  skipPaths?: string[]
}

export interface SnapshotInputs {
  scope: SnapshotInputScope
  versions: ReadonlyMap<string, string>
}

function excluded(file: string, scope: SnapshotInputScope) {
  return scope.excluded.some(root => file === root || file.startsWith(`${root}/`))
}

/** 内容版本同时覆盖目录增删；不依赖 mtime 精度，也不把输出和支持文件当作输入。 */
export async function captureSnapshotInputs(scope: SnapshotInputScope): Promise<SnapshotInputs> {
  const versions = new Map<string, string>()
  const physicalPaths = new Map<string, Promise<string>>()
  const physicalPath = (file: string): Promise<string> => {
    let pending = physicalPaths.get(file)
    if (!pending) {
      pending = realpath(file).then(normalizeFsResolvedId).catch(async (error) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || path.dirname(file) === file) {
          throw error
        }
        return path.join(await physicalPath(path.dirname(file)), path.basename(file))
      })
      physicalPaths.set(file, pending)
    }
    return pending
  }
  const aliases = async (files: string[]) => [...new Set((await Promise.all(files.map(async file => [normalizeFsResolvedId(file), await physicalPath(file)]))).flat())]
  scope = { ...scope, excluded: await aliases(scope.excluded), skipPaths: await aliases(scope.skipPaths ?? []) }
  const record = (file: string, physical: string, version: string) => {
    versions.set(file, version)
    versions.set(physical, version)
  }
  const visit = async (input: string, parents: ReadonlySet<string> = new Set()) => {
    const file = normalizeFsResolvedId(input)
    if (versions.has(file) || excluded(file, scope)) {
      return
    }
    const physical = await physicalPath(file)
    if (excluded(physical, scope)) {
      return
    }
    try {
      const stat = await lstat(file)
      if (stat.isDirectory() || stat.isSymbolicLink()) {
        const target = physical
        if (parents.has(target)) {
          versions.set(file, `cycle:${target}`)
          return
        }
        if (stat.isDirectory() || (await lstat(target)).isDirectory()) {
          const names = (await readdir(file)).filter(name => !excluded(path.join(file, name), scope)
            && !scope.skipPaths?.includes(path.join(file, name))).sort()
          record(file, physical, `directory:${JSON.stringify(names)}`)
          const ancestors = new Set([...parents, target])
          await Promise.all(names.map(name => visit(path.join(file, name), ancestors)))
          return
        }
      }
      const content = await readFile(file)
      record(file, physical, createHash('sha256').update(content).digest('hex'))
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      record(file, physical, 'missing')
    }
  }
  await Promise.all([...new Set([...scope.roots, ...scope.files])].map(file => visit(file)))
  return { scope, versions }
}

export function sameSnapshotInputs(left: SnapshotInputs, right: SnapshotInputs) {
  return left.versions.size === right.versions.size && [...left.versions].every(([file, version]) => right.versions.get(file) === version)
}

/** 新发现的外部依赖若没有构建前版本，保守地取消复用。 */
export function coversSnapshotInputs(inputs: SnapshotInputs, files: Iterable<string>) {
  return [...files].every((file) => {
    if (!path.isAbsolute(file)) {
      return true
    }
    const normalized = normalizeFsResolvedId(file)
    if (excluded(normalized, inputs.scope) || inputs.versions.has(normalized)) {
      return true
    }
    if (inputs.scope.skipPaths?.some(root => normalized === root || normalized.startsWith(`${root}/`))) {
      return false
    }
    // 目录清单本身证明未列出的后缀不存在；新入口的可选 sidecar 无需预先枚举。
    let child = normalized
    for (let parent = path.dirname(child); parent !== child; child = parent, parent = path.dirname(parent)) {
      const version = inputs.versions.get(parent)
      if (version === 'missing') {
        return true
      }
      if (version?.startsWith('directory:')) {
        const names = JSON.parse(version.slice('directory:'.length)) as string[]
        return !names.includes(path.basename(child))
      }
    }
    return false
  })
}

export async function validateSnapshotInputs(inputs: SnapshotInputs) {
  try {
    return sameSnapshotInputs(inputs, await captureSnapshotInputs(inputs.scope))
  }
  catch {
    // 无法确认输入版本时重新走原有编译路径，让原有诊断处理读取错误。
    return false
  }
}
