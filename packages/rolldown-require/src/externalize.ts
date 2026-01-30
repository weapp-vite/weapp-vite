import type { PluginContext, ResolvedId, ResolveIdExtraOptions } from 'rolldown'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isNodeBuiltin, isNodeLikeBuiltin } from './utils'

export function createExternalizeDepsPlugin({
  entryFile,
  isESM,
}: {
  entryFile: string
  isESM: boolean
}) {
  const entryDir = path.dirname(entryFile)
  const externalizeCache = new Map<
    string,
    { id: string, external: boolean | 'absolute' } | string | null
  >()
  const entryResolveCache = new Map<string, boolean>()

  return {
    name: 'externalize-deps',
    resolveId: {
      filter: { id: /^[^.#].*/ },
      async handler(
        this: PluginContext,
        id: string,
        importer: string | undefined,
        options: ResolveIdExtraOptions,
      ) {
        const { kind } = options
        if (!importer || path.isAbsolute(id) || isNodeBuiltin(id)) {
          return
        }

        // With the `isNodeBuiltin` check above, this check captures non-node built-ins so
        // we let the host runtime handle them natively.
        if (isNodeLikeBuiltin(id)) {
          return { id, external: true }
        }

        const cacheKey = `${importer}::${kind}::${id}`
        const cached = externalizeCache.get(cacheKey)
        if (cached !== undefined) {
          return cached ?? undefined
        }

        const isImport = isESM || kind === 'dynamic-import'
        const resolved = await resolveWithRolldown(this, id, importer, kind)
        if (!resolved?.id) {
          externalizeCache.set(cacheKey, null)
          return
        }
        if (resolved.external) {
          const external: boolean | 'absolute'
            = resolved.external === 'absolute' ? 'absolute' : true
          const result: { id: string, external: boolean | 'absolute' } = {
            id: resolved.id,
            external,
          }
          externalizeCache.set(cacheKey, result)
          return result
        }

        const { cleanId, query } = splitIdAndQuery(resolved.id)
        const resolvedPath = toFilePath(cleanId)
        if (!resolvedPath) {
          externalizeCache.set(cacheKey, null)
          return
        }
        if (!path.isAbsolute(resolvedPath)) {
          externalizeCache.set(cacheKey, null)
          return
        }

        // Always leave JSON to rolldown — it can't externalize with attributes yet.
        if (resolvedPath.endsWith('.json')) {
          const idWithQuery = resolvedPath + query
          externalizeCache.set(cacheKey, idWithQuery)
          return idWithQuery
        }

        const shouldExternalize = shouldExternalizeBareImport(
          id,
          importer,
          entryDir,
          resolvedPath,
          entryResolveCache,
        )

        let idOut = resolvedPath + query
        if (isImport && shouldExternalize) {
          idOut = pathToFileURL(resolvedPath).href + query
        }

        const result = { id: idOut, external: shouldExternalize }
        externalizeCache.set(cacheKey, result)
        return result
      },
    },
  }
}

export function shouldExternalizeBareImport(
  specifier: string,
  importer: string,
  entryDir: string,
  resolvedPath?: string,
  canResolveCache?: Map<string, boolean>,
): boolean {
  // Keep relative/absolute handled elsewhere.
  if (!specifier || specifier.startsWith('.') || path.isAbsolute(specifier)) {
    return false
  }

  // Builtins already handled earlier.
  if (isNodeLikeBuiltin(specifier)) {
    return true
  }

  const importerPath = normalizeImporterPath(importer, entryDir)
  const resolvedFromImporter = resolvedPath ?? resolveSpecifierFromImporter(specifier, importerPath)
  if (resolvedFromImporter) {
    const containingNodeModules = findContainingNodeModules(resolvedFromImporter)
    if (containingNodeModules) {
      const ownerDir = path.dirname(containingNodeModules)
      const ownerInsideEntry = isPathWithinDirectory(entryDir, ownerDir)
      const entryInsideOwner = isPathWithinDirectory(ownerDir, entryDir)
      // If dependency's owner sits under the entry (nested node_modules) and the entry
      // is not inside that package, inline it so execution from a temp dir still works.
      if (ownerInsideEntry && !entryInsideOwner) {
        return false
      }
    }
  }

  if (!canResolveFromEntry(specifier, entryDir, canResolveCache)) {
    return false
  }

  // If resolved path sits outside entryDir (e.g., hoisted deps), externalize.
  return true
}

function normalizeImporterPath(importer: string | undefined, fallback: string): string {
  if (!importer || importer.startsWith('\0')) {
    return fallback
  }
  const [withoutQuery] = importer.split('?')
  return withoutQuery || fallback
}

function findContainingNodeModules(filePath: string): string | undefined {
  let current = path.dirname(filePath)
  const { root } = path.parse(current)
  while (true) {
    if (path.basename(current) === 'node_modules') {
      return current
    }
    if (current === root) {
      break
    }
    current = path.dirname(current)
  }
}

function isPathWithinDirectory(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)
  return (
    relative === ''
    || (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

function getPackageName(specifier: string): string | undefined {
  if (!specifier) {
    return undefined
  }
  if (specifier.startsWith('@')) {
    const segments = specifier.split('/')
    if (segments.length >= 2) {
      return `${segments[0]}/${segments[1]}`
    }
    return undefined
  }
  const [name] = specifier.split('/')
  return name || undefined
}

function canResolveFromEntry(
  specifier: string,
  entryDir: string,
  cache?: Map<string, boolean>,
): boolean {
  const packageName = getPackageName(specifier)
  if (!packageName) {
    return false
  }
  if (cache?.has(packageName)) {
    return cache.get(packageName)!
  }
  let currentDir = entryDir
  while (true) {
    if (fs.existsSync(path.join(currentDir, 'node_modules', packageName))) {
      cache?.set(packageName, true)
      return true
    }
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }
    currentDir = parentDir
  }
  cache?.set(packageName, false)
  return false
}

function resolveWithRolldown(
  ctx: PluginContext,
  id: string,
  importer: string,
  kind: ResolveIdExtraOptions['kind'],
): Promise<ResolvedId | null> {
  return ctx.resolve(id, importer, { kind, skipSelf: true })
}

function splitIdAndQuery(id: string) {
  const [cleanId, rawQuery] = id.split('?')
  return { cleanId, query: rawQuery ? `?${rawQuery}` : '' }
}

function toFilePath(id: string): string | null {
  if (!id) {
    return null
  }
  if (id.startsWith('file://')) {
    return fileURLToPath(id)
  }
  return id
}

function resolveSpecifierFromImporter(
  specifier: string,
  importerPath: string,
): string | undefined {
  try {
    return createRequire(importerPath).resolve(specifier)
  }
  catch {
    return undefined
  }
}
