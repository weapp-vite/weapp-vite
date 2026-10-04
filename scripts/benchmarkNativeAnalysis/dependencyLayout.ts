import type { Stats } from 'node:fs'
import { lstat, readFile, readlink, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from './artifacts'

interface LayoutRoots {
  root: string
  source: string
  project: string
}

type Observation<T> = { ok: true, value: T } | { ok: false, code: string }

function portablePath(value: string) {
  const slashes = value.replaceAll('\\', '/').replace(/^\/\/\?\/UNC\//i, '//').replace(/^\/\/\?\//, '')
  const windows = /^[a-z]:\//i.test(slashes) || slashes.startsWith('//')
  return { value: (windows ? path.win32 : path.posix).normalize(slashes).replaceAll('\\', '/'), windows }
}

/** 保留仓库和暂存工程的路径归属，外部目标只记录摘要。 */
export function sanitizeDependencyPath(value: string, roots: Pick<LayoutRoots, 'root' | 'project'>) {
  const normalized = portablePath(value)
  const candidate = normalized.windows ? normalized.value.toLowerCase() : normalized.value
  const prefixes = [
    { path: portablePath(roots.project), label: '<project>' },
    { path: portablePath(roots.root), label: '<repo>' },
  ].sort((a, b) => b.path.value.length - a.path.value.length)
  for (const entry of prefixes) {
    if (entry.path.windows !== normalized.windows) {
      continue
    }
    const root = entry.path.value.replace(/\/$/, '')
    const comparable = normalized.windows ? root.toLowerCase() : root
    if (candidate === comparable) {
      return entry.label
    }
    if (candidate.startsWith(`${comparable}/`)) {
      return `${entry.label}/${normalized.value.slice(root.length + 1)}`
    }
  }
  return `<external:${sha256(candidate).slice(0, 16)}>`
}

function errorCode(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  return typeof code === 'string' && /^[A-Z][A-Z\d_]*$/.test(code) ? code : 'UNKNOWN'
}

async function observe<T>(read: () => Promise<T>): Promise<Observation<T>> {
  try {
    return { ok: true, value: await read() }
  }
  catch (error) {
    return { ok: false, code: errorCode(error) }
  }
}

function fileType(value: Stats) {
  return { isDirectory: value.isDirectory(), isSymbolicLink: value.isSymbolicLink(), isFile: value.isFile() }
}

function packageField(value: unknown, pattern: RegExp) {
  if (typeof value !== 'string') {
    return null
  }
  return pattern.test(value) ? value : `<redacted:${sha256(value).slice(0, 16)}>`
}

async function packageIdentity(file: string) {
  const text = await readFile(file, 'utf8')
  let manifest: unknown
  try {
    manifest = JSON.parse(text) as unknown
  }
  catch {
    throw Object.assign(new Error('Invalid package manifest'), { code: 'INVALID_PACKAGE_JSON' })
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw Object.assign(new Error('Invalid package manifest'), { code: 'INVALID_PACKAGE_JSON' })
  }
  return {
    name: packageField('name' in manifest ? manifest.name : undefined, /^(?:@[\w.-]+\/)?[\w.-]+$/),
    version: packageField('version' in manifest ? manifest.version : undefined, /^\d[\w.+-]*$/),
  }
}

/** 每条直接依赖路径独立读取，不使用可能向祖先回退的模块解析。 */
export async function captureDependencyLayout(roots: LayoutRoots) {
  const locations = await Promise.all((['source', 'project', 'repo'] as const).map(async (location) => {
    const directory = location === 'repo' ? roots.root : roots[location]
    const target = path.join(directory, 'node_modules/weapp-vite')
    const [linkType, targetType, link, resolved, packageJson] = await Promise.all([
      observe(async () => fileType(await lstat(target))),
      observe(async () => fileType(await stat(target))),
      observe(async () => {
        const value = await readlink(target)
        const relative = !path.isAbsolute(value)
        const resolved = relative ? path.resolve(await realpath(path.dirname(target)), value) : value
        return { target: sanitizeDependencyPath(resolved, roots), relative }
      }),
      observe(async () => sanitizeDependencyPath(await realpath(target), roots)),
      observe(() => packageIdentity(path.join(target, 'package.json'))),
    ])
    return { location, path: sanitizeDependencyPath(target, roots), lstat: linkType, stat: targetType, readlink: link, realpath: resolved, packageJson }
  }))
  return { schemaVersion: 1, locations }
}
