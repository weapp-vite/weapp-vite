import type { CacheEvent, InternalOptions } from './types'
import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { findNearestNodeModules } from './packages'
import { tryStatSync } from './utils'

const _require = createRequire(import.meta.url)

export interface CacheConfig {
  enabled: boolean
  key: string
  dir: string
  reset: boolean
  entryPath: string
  onEvent?: (event: CacheEvent) => void
}

export interface CacheMeta {
  format: 'cjs' | 'esm'
  codePath: string
  files: { path: string, mtimeMs: number, size: number }[]
}

export interface CacheRead {
  codePath: string
}

export function resolveCacheOptions(fileName: string, options: InternalOptions): CacheConfig {
  const cacheOpt = options.cache
  const enabled = cacheOpt === true
    || (typeof cacheOpt === 'object' && cacheOpt.enabled !== false)
  if (!enabled) {
    return {
      enabled: false,
      key: '',
      dir: '',
      reset: false,
      entryPath: fileName,
      onEvent: undefined,
    }
  }

  const dir = typeof cacheOpt === 'object' && cacheOpt.dir
    ? cacheOpt.dir
    : resolveDefaultCacheDir(fileName)
  const reset = typeof cacheOpt === 'object' && cacheOpt.reset === true
  const onEvent = typeof cacheOpt === 'object' ? cacheOpt.onEvent : undefined
  const stat = tryStatSync(fileName)
  if (!stat) {
    onEvent?.({ type: 'skip-invalid', key: '', reason: 'missing-entry' })
    return {
      enabled: false,
      key: '',
      dir,
      reset,
      entryPath: fileName,
      onEvent,
    }
  }
  const hash = crypto.createHash('sha1')
  hash.update(
    JSON.stringify({
      entry: path.resolve(fileName),
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      format: options.format,
      isESM: options.isESM,
      tsconfig: options.tsconfig ?? 'auto',
      node: process.versions.node,
    }),
  )

  return {
    enabled: true,
    key: hash.digest('hex'),
    dir,
    reset,
    entryPath: path.resolve(fileName),
    onEvent,
  }
}

export function resolveDefaultCacheDir(fileName: string): string {
  if (typeof process.versions.deno !== 'string') {
    const nearest = findNearestNodeModules(path.dirname(fileName))
    if (nearest) {
      return path.resolve(nearest, '.rolldown-require-cache')
    }
  }
  return path.join(os.tmpdir(), 'rolldown-require-cache')
}

export async function maybeReadCache(
  cache: CacheConfig,
  options: InternalOptions,
): Promise<CacheRead | undefined> {
  const metaPath = path.join(cache.dir, `${cache.key}.meta.json`)
  let meta: CacheMeta
  try {
    const raw = await fsp.readFile(metaPath, 'utf-8')
    meta = JSON.parse(raw) as CacheMeta
  }
  catch {
    return
  }

  if (meta.format !== options.format) {
    cache.onEvent?.({
      type: 'skip-invalid',
      key: cache.key,
      reason: 'format-mismatch',
    })
    return
  }
  if (!meta.codePath || !fs.existsSync(meta.codePath)) {
    cache.onEvent?.({
      type: 'skip-invalid',
      key: cache.key,
      reason: 'missing-code',
    })
    return
  }
  for (const file of meta.files ?? []) {
    const stat = tryStatSync(file.path)
    if (!stat || stat.mtimeMs !== file.mtimeMs || stat.size !== file.size) {
      cache.onEvent?.({
        type: 'skip-invalid',
        key: cache.key,
        reason: 'stale-deps',
      })
      return
    }
  }
  return { codePath: meta.codePath }
}

export async function importCachedCode(cached: CacheRead, options: InternalOptions) {
  const target = options.format === 'esm'
    ? pathToFileURL(cached.codePath).href
    : cached.codePath
  if (options.require) {
    return options.require(target, { format: options.format })
  }
  if (options.format === 'esm') {
    return import(target)
  }
  return _require(target)
}

export async function storeCacheOutput(
  cache: CacheConfig,
  code: string,
  options: InternalOptions,
  dependencies?: string[],
) {
  await fsp.mkdir(cache.dir, { recursive: true })
  const ext = options.format === 'cjs' ? 'cjs' : 'mjs'
  const codePath = path.join(cache.dir, `${cache.key}.code.${ext}`)
  if (cache.reset) {
    await Promise.allSettled([
      fsp.rm(codePath, { force: true }),
      fsp.rm(path.join(cache.dir, `${cache.key}.meta.json`), { force: true }),
    ])
  }
  await fsp.writeFile(codePath, code)

  const trackedFiles = collectFileStats([
    cache.entryPath,
    ...(dependencies ?? []),
  ])

  return {
    outfile: options.format === 'esm' ? pathToFileURL(codePath).href : codePath,
    cleanup: async () => {},
    cacheMeta: {
      format: options.format,
      codePath,
      files: trackedFiles,
    } satisfies CacheMeta,
  }
}

export async function writeCacheMeta(cache: CacheConfig, meta: CacheMeta) {
  await fsp.mkdir(cache.dir, { recursive: true })
  await fsp.writeFile(
    path.join(cache.dir, `${cache.key}.meta.json`),
    JSON.stringify(meta),
  )
}

export function collectFileStats(files: string[]) {
  const seen = new Set<string>()
  const stats: { path: string, mtimeMs: number, size: number }[] = []
  for (const file of files) {
    if (!file || seen.has(file)) {
      continue
    }
    seen.add(file)
    const stat = tryStatSync(file)
    if (stat?.isFile()) {
      stats.push({
        path: path.resolve(file),
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      })
    }
  }
  return stats
}
