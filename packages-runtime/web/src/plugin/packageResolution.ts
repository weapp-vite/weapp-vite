import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'pathe'
import { resolveScriptFile } from './files'

type PackageResolve = (id: string) => string

interface MiniProgramPackageMeta {
  root: string
  miniprogram: string
}

interface PackageRequest {
  packageName: string
  subpath: string
  packageRootRelative: boolean
}

function parsePackageSubpath(id: string, packageRootRelative = false): PackageRequest | undefined {
  const segments = id.split('/')
  const packageSegmentCount = id.startsWith('@') ? 2 : 1
  if (segments.length <= packageSegmentCount) {
    return undefined
  }
  return {
    packageName: segments.slice(0, packageSegmentCount).join('/'),
    subpath: segments.slice(packageSegmentCount).join('/'),
    packageRootRelative,
  }
}

function parsePackageRequest(id: string) {
  if (!id || id.startsWith('.') || id.startsWith('\0')) {
    return undefined
  }

  const normalized = id.replace(/\\/g, '/')
  const nodeModulesMarker = '/node_modules/'
  const nodeModulesIndex = normalized.lastIndexOf(nodeModulesMarker)
  if (nodeModulesIndex >= 0) {
    return parsePackageSubpath(normalized.slice(nodeModulesIndex + nodeModulesMarker.length), true)
  }

  if (normalized.startsWith('/')) {
    return undefined
  }
  return parsePackageSubpath(normalized)
}

export function getAncestorNodeModulesPaths(root: string) {
  const paths: string[] = []
  let current = resolve(root)
  while (true) {
    paths.push(resolve(current, 'node_modules'))
    const parent = dirname(current)
    if (parent === current) {
      return paths
    }
    current = parent
  }
}

export function createMiniProgramPackageResolver(resolvePackage: PackageResolve) {
  const packageMetaCache = new Map<string, Promise<MiniProgramPackageMeta | undefined>>()

  const loadPackageMeta = (packageName: string) => {
    let pending = packageMetaCache.get(packageName)
    if (!pending) {
      pending = (async () => {
        try {
          const manifestPath = resolvePackage(`${packageName}/package.json`)
          const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown
          if (!manifest || typeof manifest !== 'object') {
            return undefined
          }
          const miniprogram = (manifest as Record<string, unknown>).miniprogram
          if (typeof miniprogram !== 'string' || !miniprogram) {
            return undefined
          }
          return {
            root: dirname(manifestPath),
            miniprogram,
          }
        }
        catch {
          return undefined
        }
      })()
      packageMetaCache.set(packageName, pending)
    }
    return pending
  }

  return async (id: string) => {
    const request = parsePackageRequest(id)
    if (!request) {
      return undefined
    }
    const meta = await loadPackageMeta(request.packageName)
    if (!meta) {
      return undefined
    }
    const packageSubpath = request.packageRootRelative
      ? request.subpath
      : `${meta.miniprogram}/${request.subpath}`
    const basePath = resolve(meta.root, packageSubpath)
    return await resolveScriptFile(basePath)
      ?? await resolveScriptFile(resolve(basePath, 'index'))
  }
}
