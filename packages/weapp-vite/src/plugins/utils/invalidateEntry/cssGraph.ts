import type { CompilerContext } from '../../context'
import fs from 'node:fs'
import path from 'pathe'
import { findJsEntry } from '../../../utils/file'
import { normalizePath } from './shared'

const importProtocols = /^(?:https?:|data:|blob:|\/)/i
const cssImportRE = /@(?:import|wv-keep-import)\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?/gi

function ensureCssGraph(ctx: CompilerContext) {
  return ctx.runtimeState.css
}

function cleanupImporterGraph(
  ctx: CompilerContext,
  importer: string,
) {
  const graph = ensureCssGraph(ctx)
  const normalizedImporter = normalizePath(importer)
  const existingDeps = graph.importerToDependencies.get(normalizedImporter)
  if (!existingDeps) {
    return
  }
  graph.importerToDependencies.delete(normalizedImporter)
  for (const dep of existingDeps) {
    const importers = graph.dependencyToImporters.get(dep)
    if (!importers) {
      continue
    }
    importers.delete(normalizedImporter)
    if (importers.size === 0) {
      graph.dependencyToImporters.delete(dep)
    }
  }
}

function registerCssImports(
  ctx: CompilerContext,
  importer: string,
  dependencies: Iterable<string>,
) {
  const graph = ensureCssGraph(ctx)
  const normalizedImporter = normalizePath(importer)
  const normalizedDeps = new Set<string>()
  for (const dependency of dependencies) {
    if (!dependency) {
      continue
    }
    normalizedDeps.add(normalizePath(dependency))
  }

  const previousDeps = graph.importerToDependencies.get(normalizedImporter) ?? new Set<string>()
  if (previousDeps.size) {
    for (const previous of previousDeps) {
      if (normalizedDeps.has(previous)) {
        continue
      }
      const importers = graph.dependencyToImporters.get(previous)
      if (!importers) {
        continue
      }
      importers.delete(normalizedImporter)
      if (importers.size === 0) {
        graph.dependencyToImporters.delete(previous)
      }
    }
  }

  graph.importerToDependencies.set(normalizedImporter, normalizedDeps)

  for (const dependency of normalizedDeps) {
    let importers = graph.dependencyToImporters.get(dependency)
    if (!importers) {
      importers = new Set<string>()
      graph.dependencyToImporters.set(dependency, importers)
    }
    importers.add(normalizedImporter)
  }
}

export async function extractCssImportDependencies(
  ctx: CompilerContext,
  importer: string,
) {
  try {
    const stats = await fs.promises.stat(importer)
    if (!stats.isFile()) {
      cleanupImporterGraph(ctx, importer)
      return
    }
  }
  catch {
    cleanupImporterGraph(ctx, importer)
    return
  }

  let cssContent: string
  try {
    cssContent = await fs.promises.readFile(importer, 'utf8')
  }
  catch {
    cleanupImporterGraph(ctx, importer)
    return
  }

  cssImportRE.lastIndex = 0
  const dependencies = new Set<string>()
  const dir = path.dirname(importer)
  while (true) {
    const match = cssImportRE.exec(cssContent)
    if (!match) {
      break
    }
    const rawSpecifier = match[1]?.trim()
    if (!rawSpecifier) {
      continue
    }

    if (importProtocols.test(rawSpecifier)) {
      if (rawSpecifier.startsWith('/')) {
        const absolute = path.resolve(ctx.configService.absoluteSrcRoot, rawSpecifier.slice(1))
        dependencies.add(absolute)
        const ext = path.extname(absolute)
        if (ext) {
          dependencies.add(absolute.slice(0, -ext.length))
        }
      }
      continue
    }

    let specifier = rawSpecifier
    if (specifier.startsWith('@/')) {
      specifier = path.join(ctx.configService.absoluteSrcRoot, specifier.slice(2))
    }
    else if (specifier === '@') {
      specifier = ctx.configService.absoluteSrcRoot
    }

    if (specifier.startsWith('~')) {
      specifier = specifier.slice(1)
    }

    const cleaned = specifier.replace(/[?#].*$/, '')

    const resolved = path.resolve(dir, cleaned)
    dependencies.add(resolved)
    const ext = path.extname(resolved)
    if (!ext) {
      dependencies.add(resolved)
    }
    else {
      dependencies.add(resolved.slice(0, -ext.length))
    }
  }

  registerCssImports(ctx, importer, dependencies)
}

function collectCssImporters(
  ctx: CompilerContext,
  dependency: string,
) {
  const graph = ensureCssGraph(ctx)
  const normalizedDependency = normalizePath(dependency)
  const matches = new Set<string>()

  const direct = graph.dependencyToImporters.get(normalizedDependency)
  if (direct) {
    for (const importer of direct) {
      matches.add(importer)
    }
  }

  const ext = path.extname(normalizedDependency)
  if (ext) {
    const base = normalizedDependency.slice(0, -ext.length)
    const baseMatches = graph.dependencyToImporters.get(base)
    if (baseMatches) {
      for (const importer of baseMatches) {
        matches.add(importer)
      }
    }
  }

  return matches
}

async function resolveScriptForCss(
  cache: Map<string, string | undefined>,
  basePath: string,
) {
  const cached = cache.get(basePath)
  if (cached !== undefined) {
    return cached
  }
  const result = await findJsEntry(basePath)
  const scriptPath = result.path
  cache.set(basePath, scriptPath)
  return scriptPath
}

export async function collectAffectedScriptsAndImporters(
  ctx: CompilerContext,
  startCssFile: string,
) {
  const queue: string[] = [normalizePath(startCssFile)]
  const visitedCss = new Set<string>()
  const affectedImporters = new Set<string>()
  const affectedScripts = new Set<string>()
  const scriptCache = new Map<string, string | undefined>()

  while (queue.length) {
    const current = queue.shift()!
    if (visitedCss.has(current)) {
      continue
    }
    visitedCss.add(current)

    const ext = path.extname(current)
    if (ext) {
      const base = current.slice(0, -ext.length)
      const script = await resolveScriptForCss(scriptCache, base)
      if (script) {
        affectedScripts.add(script)
      }
    }

    const importers = collectCssImporters(ctx, current)
    for (const importer of importers) {
      if (!visitedCss.has(importer)) {
        queue.push(importer)
      }
      affectedImporters.add(importer)
    }
  }

  return {
    importers: affectedImporters,
    scripts: affectedScripts,
  }
}

export function cleanupCssImporterGraph(ctx: CompilerContext, importer: string) {
  cleanupImporterGraph(ctx, importer)
}
