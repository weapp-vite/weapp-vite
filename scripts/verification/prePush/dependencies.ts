import { lstat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse, parseAllDocuments } from 'yaml'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
  }
  return value
}

function workspaceLock(source: string): unknown {
  const documents = parseAllDocuments(source)
  if (!documents.length || documents.some(document => document.errors.length)) {
    throw new Error('依赖锁文件格式无效')
  }
  // pnpm 12 的首个文档属于包管理器自身，末个文档才是 workspace 依赖图。
  const lock: unknown = documents.at(-1)!.toJSON()
  if (!lock || typeof lock !== 'object' || Array.isArray(lock)) {
    throw new Error('依赖锁文件缺少 workspace 对象')
  }
  const record = lock as { lockfileVersion?: unknown, importers?: unknown }
  if (!['number', 'string'].includes(typeof record.lockfileVersion)
    || !record.importers || typeof record.importers !== 'object' || Array.isArray(record.importers)) {
    throw new Error('依赖锁文件缺少版本或 importer 图')
  }
  return lock
}

/** 当前工作树只有在完整依赖与候选锁一致、且根依赖目录独立时才可借用。 */
export async function hasCandidateDependencies(root: string): Promise<boolean> {
  try {
    const modules = path.join(root, 'node_modules')
    if (!(await lstat(modules)).isDirectory()) {
      return false
    }
    const [manifestSource, lock, installedLock, metadataSource] = await Promise.all([
      readFile(path.join(root, 'package.json'), 'utf8'),
      readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8'),
      readFile(path.join(modules, '.pnpm/lock.yaml'), 'utf8'),
      readFile(path.join(modules, '.modules.yaml'), 'utf8'),
    ])
    const manifest = JSON.parse(manifestSource) as { packageManager?: string }
    const metadata = parse(metadataSource) as { packageManager?: string, included?: Record<string, boolean> }
    return metadata?.packageManager === manifest.packageManager?.split('+')[0]
      && ['dependencies', 'devDependencies', 'optionalDependencies'].every(kind => metadata.included?.[kind] === true)
      && JSON.stringify(canonical(workspaceLock(lock))) === JSON.stringify(canonical(workspaceLock(installedLock)))
  }
  catch {
    // 缺少、损坏或无法确认的安装证明均走独立 frozen install，不降低验证范围。
    return false
  }
}
