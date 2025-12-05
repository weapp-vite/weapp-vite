import type { CacheMeta } from './cache'
import type { InternalOptions, RequireFunction } from './types'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  collectFileStats,
  importCachedCode,
  maybeReadCache,
  resolveCacheOptions,
  storeCacheOutput,
  writeCacheMeta,
  writeMemoryCache,
} from './cache'
import { resolveTempOutputFile } from './temp-output'
import { dynamicImport, tryStatSync } from './utils'

interface NodeModuleWithCompile extends NodeModule {
  _compile: (code: string, filename: string) => any
}

const _require = createRequire(import.meta.url)
const promisifiedRealpath = promisify(fs.realpath)

export async function loadFromBundledFile(
  fileName: string,
  bundledCode: string,
  options: InternalOptions,
  dependencies?: string[],
): Promise<any> {
  const cacheConfig = resolveCacheOptions(fileName, options)
  if (cacheConfig.enabled) {
    const cached = await maybeReadCache(cacheConfig, options)
    if (cached) {
      if (!cached.mod) {
        cacheConfig.onEvent?.({ type: 'hit', key: cacheConfig.key })
      }
      return importCachedCode(cached, options)
    }
    cacheConfig.onEvent?.({ type: 'miss', key: cacheConfig.key })
  }

  const { isESM } = options
  // for esm, before we can register loaders without requiring users to run node
  // with --experimental-loader themselves, we have to do a hack here:
  // write it to disk, load it with native Node ESM, then delete the file.
  if (isESM) {
    const tempOutput = cacheConfig.enabled
      ? await storeCacheOutput(cacheConfig, bundledCode, options, dependencies)
      : await resolveTempOutputFile(fileName, bundledCode, options)
    const outfile = tempOutput?.outfile
    const cleanup = tempOutput?.cleanup
    let mod: any
    const req: RequireFunction = options.require || dynamicImport
    try {
      mod = await req(outfile, { format: options.format })
      if (cacheConfig.enabled && tempOutput?.cacheMeta) {
        await writeCacheMeta(cacheConfig, tempOutput.cacheMeta)
        cacheConfig.onEvent?.({ type: 'store', key: cacheConfig.key })
        writeMemoryCache(cacheConfig, mod, tempOutput.cacheMeta)
      }
      return mod
    }
    finally {
      if (!cacheConfig.enabled) {
        await cleanup?.()
      }
    }
  }
  // for cjs, we can register a custom loader via `_require.extensions`
  else {
    const extension = path.extname(fileName)
    // We don't use fsp.realpath() here because it has the same behaviour as
    // fs.realpath.native. On some Windows systems, it returns uppercase volume
    // letters (e.g. "C:\") while the Node.js loader uses lowercase volume letters.
    // See https://github.com/vitejs/vite/issues/12923
    const realFileName = await promisifiedRealpath(fileName)
    const loaderExt = extension in _require.extensions ? extension : '.js'
    const defaultLoader = _require.extensions[loaderExt]!
    // Swap in a temporary loader so we can compile the bundled source on demand.
    const compileLoader = (module: NodeModule, filename: string) => {
      if (filename === realFileName) {
        ; (module as NodeModuleWithCompile)._compile(bundledCode, filename)
      }
      else {
        defaultLoader(module, filename)
      }
    }
    let raw: any
    try {
      _require.extensions[loaderExt] = compileLoader
      // clear cache in case of server restart
      delete _require.cache[_require.resolve(fileName)]
      raw = _require(fileName)
      return raw.__esModule ? raw.default : raw
    }
    finally {
      _require.extensions[loaderExt] = defaultLoader
      if (cacheConfig.enabled && raw !== undefined) {
        const cachedPath = await storeCacheOutput(
          cacheConfig,
          bundledCode,
          options,
          dependencies,
        )
        await writeCacheMeta(cacheConfig, cachedPath.cacheMeta as CacheMeta)
        cacheConfig.onEvent?.({ type: 'store', key: cacheConfig.key })
        writeMemoryCache(
          cacheConfig,
          raw.__esModule ? raw.default : raw,
          cachedPath.cacheMeta as CacheMeta,
        )
      }
    }
  }
}

export function collectDependenciesSnapshot(
  entryPath: string,
  dependencies?: string[],
) {
  return collectFileStats([
    entryPath,
    ...(dependencies ?? []),
  ])
}

export function isInvalidEntry(fileName: string): boolean {
  const stat = tryStatSync(fileName)
  return !stat
}
