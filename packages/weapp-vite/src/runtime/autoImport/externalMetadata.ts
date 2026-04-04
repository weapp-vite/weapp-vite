import type { AstEngineName } from '../../ast'
import type { ExternalMetadataFileCandidates, Resolver } from '../../auto-import-components/resolvers'
import type { ComponentPropMap } from '../componentProps'
import { createRequire } from 'node:module'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { parseNpmPackageSpecifier } from '../../utils/npmImport'
import { extractComponentProps } from '../componentProps'
import { extractComponentPropsFromDts } from './dtsProps'

export interface ExternalComponentMetadata {
  types: ComponentPropMap
}

const metadataCache = new WeakMap<Resolver[], Map<string, ExternalComponentMetadata | null>>()
const fallbackMetadataCache = new Map<string, ExternalComponentMetadata | null>()

function getMetadataCache(resolvers?: Resolver[]) {
  if (!resolvers) {
    return fallbackMetadataCache
  }
  let cache = metadataCache.get(resolvers)
  if (!cache) {
    cache = new Map()
    metadataCache.set(resolvers, cache)
  }
  return cache
}

function safeCreateRequire(cwd: string) {
  try {
    return createRequire(path.resolve(cwd, 'package.json'))
  }
  catch {
    return createRequire(import.meta.url)
  }
}

function tryResolvePackageRoot(packageName: string, cwd: string) {
  const require = safeCreateRequire(cwd)
  try {
    const pkgJson = require.resolve(`${packageName}/package.json`)
    return path.dirname(pkgJson)
  }
  catch {
    return undefined
  }
}

function readTextIfExists(filePath: string) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  }
  catch {
    return undefined
  }
}

function resolveExternalMetadataCandidates(from: string, resolvers: Resolver[] | undefined): ExternalMetadataFileCandidates | undefined {
  if (!Array.isArray(resolvers) || resolvers.length === 0) {
    return undefined
  }

  for (const resolver of resolvers) {
    const fn = resolver?.resolveExternalMetadataCandidates
    if (typeof fn !== 'function') {
      continue
    }
    const candidates = fn(from)
    if (candidates) {
      return candidates
    }
  }

  return undefined
}

function resolveHeuristicExternalMetadataCandidates(from: string): ExternalMetadataFileCandidates | undefined {
  const parsed = parseNpmPackageSpecifier(from)
  if (!parsed?.packageName) {
    return undefined
  }

  const { packageName, subPath } = parsed
  if (!subPath) {
    return undefined
  }

  const dts = [
    `lib/${subPath}/index.d.ts`,
    `dist/${subPath}/index.d.ts`,
    `esm/${subPath}/index.d.ts`,
    `miniprogram_dist/${subPath}.d.ts`,
    `${subPath}.d.ts`,
    `${subPath}/index.d.ts`,
  ]

  const js = [
    `lib/${subPath}/index.js`,
    `dist/${subPath}/index.js`,
    `esm/${subPath}/index.js`,
    `miniprogram_dist/${subPath}.js`,
    `${subPath}.js`,
    `${subPath}.cjs`,
    `${subPath}.mjs`,
    `${subPath}/index.js`,
    `${subPath}/index.cjs`,
    `${subPath}/index.mjs`,
  ]

  return {
    packageName,
    dts,
    js,
  }
}

function resolveResolverMetadataFiles(from: string, cwd: string, resolvers: Resolver[] | undefined) {
  const candidates = resolveExternalMetadataCandidates(from, resolvers)
    ?? resolveHeuristicExternalMetadataCandidates(from)
  if (!candidates) {
    return undefined
  }

  const pkgRoot = tryResolvePackageRoot(candidates.packageName, cwd)
  if (!pkgRoot) {
    return undefined
  }

  return {
    dts: candidates.dts.map(file => path.join(pkgRoot, file)),
    js: candidates.js.map(file => path.join(pkgRoot, file)),
  }
}

function resolveGenericMetadataFiles(from: string, cwd: string) {
  if (!from || from.startsWith('/')) {
    return undefined
  }

  const require = safeCreateRequire(cwd)
  try {
    const resolved = require.resolve(from)
    const ext = path.extname(resolved)
    const base = ext ? resolved.slice(0, -ext.length) : resolved
    return {
      dts: [`${base}.d.ts`],
      js: [`${base}.js`, `${base}.cjs`, `${base}.mjs`],
    }
  }
  catch {
    return undefined
  }
}

function resolveExternalMetadataFiles(from: string, cwd: string, resolvers: Resolver[] | undefined) {
  return resolveResolverMetadataFiles(from, cwd, resolvers)
    ?? resolveGenericMetadataFiles(from, cwd)
}

export function loadExternalComponentMetadata(
  from: string,
  cwd: string,
  resolvers?: Resolver[],
  options?: {
    astEngine?: AstEngineName
  },
): ExternalComponentMetadata | undefined {
  const cache = getMetadataCache(resolvers)
  const cacheKey = `${options?.astEngine ?? 'babel'}\n${cwd}\n${from}`
  const cached = cache.get(cacheKey)
  if (cached !== undefined) {
    return cached ?? undefined
  }

  const files = resolveExternalMetadataFiles(from, cwd, resolvers)
  if (!files) {
    cache.set(cacheKey, null)
    return undefined
  }

  for (const candidate of files.dts) {
    const code = readTextIfExists(candidate)
    if (!code) {
      continue
    }
    try {
      const types = extractComponentPropsFromDts(code)
      if (types.size > 0) {
        const result = { types }
        cache.set(cacheKey, result)
        return result
      }
    }
    catch {
      // 忽略
    }
  }

  for (const candidate of files.js) {
    const code = readTextIfExists(candidate)
    if (!code) {
      continue
    }
    try {
      const types = extractComponentProps(code, {
        astEngine: options?.astEngine,
      })
      if (types.size > 0) {
        const result = { types }
        cache.set(cacheKey, result)
        return result
      }
    }
    catch {
      // 忽略
    }
  }

  cache.set(cacheKey, null)
  return undefined
}
