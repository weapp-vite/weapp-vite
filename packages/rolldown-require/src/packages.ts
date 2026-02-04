import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import {
  createFilter,
  normalizePath,
  safeRealpathSync,
  stripBomTag,
  tryStatSync,
} from './utils'

interface InternalResolveOptions {
  isRequire: boolean
  conditions: string[]
  extensions: string[]
  mainFields: string[]
}

let pnp: typeof import('pnpapi') | undefined
if (process.versions.pnp) {
  try {
    pnp = createRequire(import.meta.url)('pnpapi')
  }
  catch {}
}

/** Cache for package.json resolution and package.json contents */
export type PackageCache = Map<string, PackageData>

export interface PackageData {
  dir: string
  hasSideEffects: (id: string) => boolean | 'no-treeshake' | null
  setResolvedCache: (
    key: string,
    entry: string,
    options: InternalResolveOptions,
  ) => void
  getResolvedCache: (
    key: string,
    options: InternalResolveOptions,
  ) => string | undefined
  data: {
    [field: string]: any
    name: string
    type: string
    version: string
    main: string
    module: string
    browser: string | Record<string, string | false>
    exports: string | Record<string, any> | string[]
    imports: Record<string, any>
    dependencies: Record<string, string>
  }
}

export function resolvePackageData(
  pkgName: string,
  basedir: string,
  preserveSymlinks = false,
  packageCache?: PackageCache,
): PackageData | null {
  if (pnp) {
    const cacheKey = getRpdCacheKey(pkgName, basedir, preserveSymlinks)
    if (packageCache?.has(cacheKey)) {
      return packageCache.get(cacheKey)!
    }

    try {
      const pkg = pnp.resolveToUnqualified(pkgName, basedir, {
        considerBuiltins: false,
      })
      if (!pkg) {
        return null
      }

      const pkgData = loadPackageData(path.join(pkg, 'package.json'))
      packageCache?.set(cacheKey, pkgData)
      return pkgData
    }
    catch {
      return null
    }
  }

  const originalBasedir = basedir
  while (basedir) {
    if (packageCache) {
      const cached = getRpdCache(
        packageCache,
        pkgName,
        basedir,
        originalBasedir,
        preserveSymlinks,
      )
      if (cached) {
        return cached
      }
    }

    const pkg = path.join(basedir, 'node_modules', pkgName, 'package.json')
    try {
      if (fs.existsSync(pkg)) {
        const pkgPath = preserveSymlinks ? pkg : safeRealpathSync(pkg)
        const pkgData = loadPackageData(pkgPath)

        if (packageCache) {
          setRpdCache(
            packageCache,
            pkgData,
            pkgName,
            basedir,
            originalBasedir,
            preserveSymlinks,
          )
        }

        return pkgData
      }
    }
    catch {}

    const nextBasedir = path.dirname(basedir)
    if (nextBasedir === basedir) {
      break
    }
    basedir = nextBasedir
  }

  return null
}

export function findNearestPackageData(
  basedir: string,
  packageCache?: PackageCache,
): PackageData | null {
  const originalBasedir = basedir
  while (basedir) {
    if (packageCache) {
      const cached = getFnpdCache(packageCache, basedir, originalBasedir)
      if (cached) {
        return cached
      }
    }

    const pkgPath = path.join(basedir, 'package.json')
    if (tryStatSync(pkgPath)?.isFile()) {
      try {
        const pkgData = loadPackageData(pkgPath)

        if (packageCache) {
          setFnpdCache(packageCache, pkgData, basedir, originalBasedir)
        }

        return pkgData
      }
      catch {}
    }

    const nextBasedir = path.dirname(basedir)
    if (nextBasedir === basedir) {
      break
    }
    basedir = nextBasedir
  }

  return null
}

// Finds the nearest package.json with a `name` field
export function findNearestMainPackageData(
  basedir: string,
  packageCache?: PackageCache,
): PackageData | null {
  const nearestPackage = findNearestPackageData(basedir, packageCache)
  return (
    nearestPackage
    && (nearestPackage.data.name
      ? nearestPackage
      : findNearestMainPackageData(
          path.dirname(nearestPackage.dir),
          packageCache,
        ))
  )
}

export function loadPackageData(pkgPath: string): PackageData {
  const data = JSON.parse(stripBomTag(fs.readFileSync(pkgPath, 'utf-8')))
  const pkgDir = normalizePath(path.dirname(pkgPath))
  const { sideEffects } = data
  let hasSideEffects: (id: string) => boolean | null
  if (typeof sideEffects === 'boolean') {
    hasSideEffects = () => sideEffects
  }
  else if (Array.isArray(sideEffects)) {
    if (sideEffects.length <= 0) {
      // createFilter always returns true if `includes` is an empty array
      // but here we want it to always return false
      hasSideEffects = () => false
    }
    else {
      const finalPackageSideEffects = sideEffects.map((sideEffect) => {
        /*
         * sideEffects 数组支持简单的 glob：不包含 / 的模式（如 *.css）会被视为 **\/*.css。
         * https://webpack.js.org/guides/tree-shaking/
         * https://github.com/vitejs/vite/pull/11807
         */
        if (sideEffect.includes('/')) {
          return sideEffect
        }
        return `**/${sideEffect}`
      })

      hasSideEffects = createFilter(finalPackageSideEffects, null, {
        resolve: pkgDir,
      })
    }
  }
  else {
    hasSideEffects = () => null
  }

  const resolvedCache: Record<string, string | undefined> = {}
  const pkg: PackageData = {
    dir: pkgDir,
    data,
    hasSideEffects,
    setResolvedCache(key, entry, options) {
      resolvedCache[getResolveCacheKey(key, options)] = entry
    },
    getResolvedCache(key, options) {
      return resolvedCache[getResolveCacheKey(key, options)]
    },
  }

  return pkg
}

function getResolveCacheKey(key: string, options: InternalResolveOptions) {
  // cache key needs to include options which affect
  // `resolvePackageEntry` or `resolveDeepImport`
  return [
    key,
    options.isRequire ? '1' : '0',
    options.conditions.join('_'),
    options.extensions.join('_'),
    options.mainFields.join('_'),
  ].join('|')
}

export function findNearestNodeModules(basedir: string): string | null {
  while (basedir) {
    const pkgPath = path.join(basedir, 'node_modules')
    if (tryStatSync(pkgPath)?.isDirectory()) {
      return pkgPath
    }

    const nextBasedir = path.dirname(basedir)
    if (nextBasedir === basedir) {
      break
    }
    basedir = nextBasedir
  }

  return null
}

/**
 * 根据 `basedir` 获取缓存的 `resolvePackageData`。
 * 当命中缓存且已遍历 `basedir` 与 `originalBasedir` 之间的路径时，
 * 会把中间目录也写入缓存。
 *
 * 这样共享的 `basedir` 只需要读一次文件系统。
 */
function getRpdCache(
  packageCache: PackageCache,
  pkgName: string,
  basedir: string,
  originalBasedir: string,
  preserveSymlinks: boolean,
) {
  const cacheKey = getRpdCacheKey(pkgName, basedir, preserveSymlinks)
  const pkgData = packageCache.get(cacheKey)
  if (pkgData) {
    traverseBetweenDirs(originalBasedir, basedir, (dir) => {
      packageCache.set(getRpdCacheKey(pkgName, dir, preserveSymlinks), pkgData)
    })
    return pkgData
  }
}

function setRpdCache(
  packageCache: PackageCache,
  pkgData: PackageData,
  pkgName: string,
  basedir: string,
  originalBasedir: string,
  preserveSymlinks: boolean,
) {
  packageCache.set(getRpdCacheKey(pkgName, basedir, preserveSymlinks), pkgData)
  traverseBetweenDirs(originalBasedir, basedir, (dir) => {
    packageCache.set(getRpdCacheKey(pkgName, dir, preserveSymlinks), pkgData)
  })
}

// package cache key for `resolvePackageData`
function getRpdCacheKey(
  pkgName: string,
  basedir: string,
  preserveSymlinks: boolean,
) {
  return `rpd_${pkgName}_${basedir}_${preserveSymlinks}`
}

/**
 * 根据 `basedir` 获取缓存的 `findNearestPackageData`。
 * 当命中缓存且已遍历 `basedir` 与 `originalBasedir` 之间的路径时，
 * 会把中间目录也写入缓存。
 *
 * 这样共享的 `basedir` 只需要读一次文件系统。
 */
function getFnpdCache(
  packageCache: PackageCache,
  basedir: string,
  originalBasedir: string,
) {
  const cacheKey = getFnpdCacheKey(basedir)
  const pkgData = packageCache.get(cacheKey)
  if (pkgData) {
    traverseBetweenDirs(originalBasedir, basedir, (dir) => {
      packageCache.set(getFnpdCacheKey(dir), pkgData)
    })
    return pkgData
  }
}

function setFnpdCache(
  packageCache: PackageCache,
  pkgData: PackageData,
  basedir: string,
  originalBasedir: string,
) {
  packageCache.set(getFnpdCacheKey(basedir), pkgData)
  traverseBetweenDirs(originalBasedir, basedir, (dir) => {
    packageCache.set(getFnpdCacheKey(dir), pkgData)
  })
}

// package cache key for `findNearestPackageData`
function getFnpdCacheKey(basedir: string) {
  return `fnpd_${basedir}`
}

/**
 * 在 `longerDir`（含）与 `shorterDir`（不含）之间遍历路径并执行回调。
 * @param longerDir 较长路径，如 `/User/foo/bar/baz`
 * @param shorterDir 较短路径，如 `/User/foo`
 */
function traverseBetweenDirs(
  longerDir: string,
  shorterDir: string,
  cb: (dir: string) => void,
) {
  while (longerDir !== shorterDir) {
    cb(longerDir)
    longerDir = path.dirname(longerDir)
  }
}
