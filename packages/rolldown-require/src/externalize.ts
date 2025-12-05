import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { configDefaults } from './config'
import { tryNodeResolve } from './plugins/resolve'
import { isNodeBuiltin, isNodeLikeBuiltin, nodeLikeBuiltins } from './utils'

export function createExternalizeDepsPlugin({
  entryFile,
  isESM,
  moduleSyncEnabled,
}: {
  entryFile: string
  isESM: boolean
  moduleSyncEnabled: boolean
}) {
  const entryDir = path.dirname(entryFile)
  const packageCache = new Map()
  const resolveByViteResolver = (
    id: string,
    importer: string,
    isRequire: boolean,
  ) => {
    return tryNodeResolve(id, importer, {
      root: path.dirname(entryFile),
      isBuild: true,
      isProduction: true,
      preferRelative: false,
      tryIndex: true,
      mainFields: [],
      conditions: [
        'node',
        ...(moduleSyncEnabled ? ['module-sync'] : []),
      ],
      externalConditions: [],
      external: [],
      noExternal: [],
      dedupe: [],
      extensions: configDefaults.resolve.extensions,
      preserveSymlinks: false,
      packageCache,
      isRequire,
      builtins: nodeLikeBuiltins,
    })?.id
  }

  return {
    name: 'externalize-deps',
    resolveId: {
      filter: { id: /^[^.#].*/ },
      async handler(id: string, importer: string | undefined, { kind }: { kind: string }) {
        if (!importer || path.isAbsolute(id) || isNodeBuiltin(id)) {
          return
        }

        // With the `isNodeBuiltin` check above, this check captures non-node built-ins so
        // we let the host runtime handle them natively.
        if (isNodeLikeBuiltin(id)) {
          return { id, external: true }
        }

        const isImport = isESM || kind === 'dynamic-import'
        let idFsPath: string | undefined
        try {
          idFsPath = resolveByViteResolver(id, importer, !isImport)
        }
        catch (e) {
          if (!isImport) {
            let canResolveWithImport = false
            try {
              canResolveWithImport = !!resolveByViteResolver(
                id,
                importer,
                false,
              )
            }
            catch { }
            if (canResolveWithImport) {
              throw new Error(
                `Failed to resolve ${JSON.stringify(
                  id,
                )}. This package is ESM only but it was tried to load by \`require\`. See https://vite.dev/guide/troubleshooting.html#this-package-is-esm-only for more details.`,
              )
            }
          }
          throw e
        }
        if (!idFsPath) {
          return
        }
        // Always leave JSON to rolldown — it can't externalize with attributes yet.
        if (idFsPath.endsWith('.json')) {
          return idFsPath
        }

        const shouldExternalize = shouldExternalizeBareImport(id, importer, entryDir)

        if (idFsPath && isImport && shouldExternalize) {
          idFsPath = pathToFileURL(idFsPath).href
        }
        return { id: idFsPath, external: shouldExternalize }
      },
    },
  }
}

export function shouldExternalizeBareImport(
  specifier: string,
  importer: string,
  entryDir: string,
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
  try {
    const containingNodeModules = findContainingNodeModules(
      createRequire(importerPath).resolve(specifier),
    )
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
  catch {
    // fall through to canResolveFromEntry
  }

  if (!canResolveFromEntry(specifier, entryDir)) {
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

function canResolveFromEntry(specifier: string, entryDir: string): boolean {
  const packageName = getPackageName(specifier)
  if (!packageName) {
    return false
  }
  let currentDir = entryDir
  while (true) {
    if (fs.existsSync(path.join(currentDir, 'node_modules', packageName))) {
      return true
    }
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }
    currentDir = parentDir
  }
  return false
}
