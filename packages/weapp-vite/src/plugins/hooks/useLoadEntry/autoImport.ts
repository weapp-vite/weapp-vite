import type { CompilerContext } from '../../../context'
import { get, isObject, set } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { getAutoImportConfig } from '../../../runtime/autoImport/config/defaults'

const GLOB_WILDCARD_RE = /[*?[{]/
const AUTO_IMPORT_LOCAL_EXTENSIONS = ['vue', 'wxml', 'js', 'ts', 'json'] as const

function toPascalTagName(name: string) {
  if (!name.includes('-')) {
    return name
  }
  return name
    .split('-')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
}

function resolveAutoImportGlobBase(glob: string, absoluteSrcRoot: string) {
  const wildcardIndex = glob.search(GLOB_WILDCARD_RE)
  const staticPart = wildcardIndex >= 0 ? glob.slice(0, wildcardIndex) : glob
  const trimmed = staticPart.replace(/\/+$/, '')
  const base = path.extname(trimmed) ? path.dirname(trimmed) : trimmed
  if (!base || base === '.') {
    return absoluteSrcRoot
  }
  return path.isAbsolute(base) ? base : path.resolve(absoluteSrcRoot, base)
}

function collectAutoImportGlobExtensions(glob: string) {
  return AUTO_IMPORT_LOCAL_EXTENSIONS.filter(ext => glob.includes(`.${ext}`))
}

function collectLocalCandidatePaths(
  componentName: string,
  globs: string[],
  absoluteSrcRoot: string,
) {
  const names = new Set([componentName, toPascalTagName(componentName)])
  const candidates = new Set<string>()
  for (const glob of globs) {
    const extensions = collectAutoImportGlobExtensions(glob)
    if (!extensions.length) {
      continue
    }
    const base = resolveAutoImportGlobBase(glob, absoluteSrcRoot)
    for (const name of names) {
      for (const ext of extensions) {
        candidates.add(path.join(base, name, `index.${ext}`))
        candidates.add(path.join(base, `${name}.${ext}`))
      }
    }
  }
  return [...candidates]
}

async function registerExistingLocalCandidates(options: {
  autoImportService: NonNullable<CompilerContext['autoImportService']>
  configService: CompilerContext['configService']
  componentNames: string[]
}) {
  const { autoImportService, configService, componentNames } = options
  if (!configService || typeof autoImportService.registerPotentialComponent !== 'function') {
    return false
  }
  const globs = getAutoImportConfig(configService)?.globs
  if (!globs?.length) {
    return false
  }

  let registered = false
  const candidates = new Set<string>()
  for (const componentName of componentNames) {
    for (const candidate of collectLocalCandidatePaths(componentName, globs, configService.absoluteSrcRoot)) {
      candidates.add(candidate)
    }
  }

  for (const candidate of candidates) {
    if (!await fs.pathExists(candidate)) {
      continue
    }
    await autoImportService.registerPotentialComponent(candidate)
    registered = true
  }

  return registered
}

export function createAutoImportAugmenter(
  autoImportService: CompilerContext['autoImportService'],
  wxmlService: CompilerContext['wxmlService'],
  externalComponentEntryMap?: Map<string, string>,
  configService?: CompilerContext['configService'],
) {
  const cache = new Map<string, {
    hit: Record<string, unknown>
    version: number
    resolvedComponents: Record<string, { from: string, resolvedId?: string }>
  }>()

  function injectResolvedComponents(
    json: any,
    resolvedComponents: Record<string, { from: string, resolvedId?: string }>,
  ) {
    const injectedEntries: string[] = []
    for (const [name, resolved] of Object.entries(resolvedComponents)) {
      const trackResolvedId = () => {
        if (resolved.resolvedId) {
          externalComponentEntryMap?.set(resolved.from.replace(/^\/+/, ''), resolved.resolvedId)
        }
      }
      const usingComponents = get(json, 'usingComponents')
      if (isObject(usingComponents) && Reflect.has(usingComponents, name)) {
        if (usingComponents[name] === resolved.from) {
          trackResolvedId()
          injectedEntries.push(resolved.from)
        }
        continue
      }

      set(json, `usingComponents.${name}`, resolved.from)
      injectedEntries.push(resolved.from)
      trackResolvedId()
    }
    return injectedEntries
  }

  return function applyAutoImports(baseName: string, json: any, retryMissing = true): string[] | Promise<string[]> {
    const hit = wxmlService.getAggregatedAutoImportComponents?.(baseName)
      ?? wxmlService.getAggregatedComponents(baseName)
    if (!hit) {
      return []
    }

    const version = autoImportService.getVersion()
    const cached = cache.get(baseName)
    const resolvedComponents = cached && cached.hit === hit && cached.version === version
      ? cached.resolvedComponents
      : (() => {
          const resolvedComponents: Record<string, { from: string, resolvedId?: string }> = {}
          const missingComponentNames: string[] = []
          for (const depComponentName of Object.keys(hit)) {
            const match = autoImportService.resolve(depComponentName, baseName)
            if (!match) {
              missingComponentNames.push(depComponentName)
              continue
            }

            resolvedComponents[match.value.name] = {
              from: match.value.from,
              resolvedId: match.value.resolvedId,
            }
          }
          cache.set(baseName, {
            hit,
            version,
            resolvedComponents,
          })
          if (
            missingComponentNames.length
            && retryMissing
            && configService
            && typeof autoImportService.registerPotentialComponent === 'function'
          ) {
            return {
              resolvedComponents,
              missingComponentNames,
            }
          }
          return resolvedComponents
        })()

    if ('missingComponentNames' in resolvedComponents) {
      return registerExistingLocalCandidates({
        autoImportService,
        configService,
        componentNames: resolvedComponents.missingComponentNames,
      }).then((registered) => {
        if (!registered) {
          return injectResolvedComponents(json, resolvedComponents.resolvedComponents)
        }
        return applyAutoImports(baseName, json, false)
      })
    }

    return injectResolvedComponents(json, resolvedComponents)
  }
}
