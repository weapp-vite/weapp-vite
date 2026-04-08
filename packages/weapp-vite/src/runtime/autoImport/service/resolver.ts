import type { ResolvedValue, Resolver, ResolverSupportFilesStrategy } from '../../../auto-import-components/resolvers'
import type { MutableCompilerContext } from '../../../context'
import type { ComponentMetadata } from '../metadata'
import type { LocalAutoImportMatch } from '../types'
import { createRequire } from 'node:module'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { parseNpmPackageSpecifier } from '../../../utils/npmImport'
import { getAutoImportConfig } from '../config'

const require = createRequire(import.meta.url)
const COMPONENT_HAS_UPPER_RE = /[A-Z]/
const CAMEL_TO_KEBAB_RE = /([a-z0-9])([A-Z])/g
const MULTI_UPPER_TO_KEBAB_RE = /([A-Z]+)([A-Z][a-z])/g
const TRAILING_RELATIVE_PREFIX_RE = /^[./]+/
const TRAILING_SLASH_RE = /\/+$/
const SCRIPT_OR_DTS_EXTENSION_RE = /\.(?:[cm]?js|tsx?|jsx|d\.ts)$/

export interface ResolverHelpers {
  collectResolverComponents: () => Record<string, string>
  collectRuntimeResolverComponents: () => Record<string, string>
  collectManifestResolverComponents: () => Record<string, string>
  clearResolveCache: () => void
  syncResolverComponentProps: () => void
  setSupportFileResolverComponents: (components: Record<string, string>) => boolean
  clearSupportFileResolverComponents: () => boolean
  collectStaticResolverComponentsForSupportFiles: () => Record<string, string>
  resolveWithResolvers: (componentName: string, importerBaseName?: string) => ResolvedValue | undefined
  resolveNavigationImport: (from: string) => string | undefined
}

interface ResolverState {
  ctx: MutableCompilerContext
  registry: Map<string, LocalAutoImportMatch>
  resolvedResolverComponents: Map<string, string>
  componentMetadataMap: Map<string, ComponentMetadata>
  resolverComponentNames: Set<string>
  resolverComponentsMapRef: { value: Record<string, string> }
}

export function createResolverHelpers(state: ResolverState): ResolverHelpers {
  const miniprogramDirCache = new Map<string, string | undefined>()
  const resolveCache = new Map<string, ResolvedValue | null>()
  const supportFileResolverComponents = new Map<string, string>()
  let compiledResolversCache: CompiledResolversCache | undefined

  function getResolveCacheKey(componentName: string, importerBaseName?: string) {
    return `${importerBaseName ?? ''}\0${componentName}`
  }

  function getSupportFilesStrategy(resolver: Resolver | undefined): ResolverSupportFilesStrategy {
    return resolver && typeof (resolver as any).supportFilesStrategy === 'string'
      ? (resolver as any).supportFilesStrategy
      : 'used'
  }

  function toComponentCandidates(componentName: string) {
    const candidates: string[] = [componentName]
    if (!componentName.includes('-') && COMPONENT_HAS_UPPER_RE.test(componentName)) {
      const kebab = componentName
        .replace(CAMEL_TO_KEBAB_RE, '$1-$2')
        .replace(MULTI_UPPER_TO_KEBAB_RE, '$1-$2')
        .toLowerCase()
      if (kebab && kebab !== componentName) {
        candidates.push(kebab)
      }
    }
    return candidates
  }

  function canUseStaticComponentLookup(resolver: Resolver) {
    return (resolver as any)?.componentLookupStrategy === 'static'
      && Boolean((resolver as any)?.components)
  }

  function getCompiledResolvers(resolvers: Resolver[]) {
    if (compiledResolversCache?.source === resolvers) {
      return compiledResolversCache.steps
    }

    const steps: CompiledResolverStep[] = resolvers.map((resolver) => {
      if (canUseStaticComponentLookup(resolver)) {
        return {
          kind: 'static',
          components: (resolver as any).components as Record<string, string>,
        }
      }
      return {
        kind: 'dynamic',
        resolver,
      }
    })

    compiledResolversCache = {
      source: resolvers,
      steps,
    }
    return steps
  }

  function resolveWithResolver(resolver: Resolver, componentName: string, baseName: string) {
    if (!resolver) {
      return undefined
    }

    const candidates = toComponentCandidates(componentName)

    // 优先按对象 resolver 处理（即使 resolver 本身是可调用函数，但额外挂了字段）。
    const resolverAny = resolver as any
    for (const candidate of candidates) {
      if (typeof resolverAny.resolve === 'function') {
        const resolved = resolverAny.resolve(candidate, baseName)
        if (resolved) {
          return candidate === componentName ? resolved : { name: componentName, from: resolved.from }
        }
      }

      const from = resolverAny.components?.[candidate]
      if (from) {
        return { name: componentName, from }
      }

      // 兜底：兼容函数写法 resolver。
      if (typeof resolver === 'function') {
        const resolved = resolver(candidate, baseName)
        if (resolved) {
          return candidate === componentName ? resolved : { name: componentName, from: resolved.from }
        }
      }
    }

    return undefined
  }

  function getMiniprogramDir(pkgName: string, cwd: string) {
    if (miniprogramDirCache.has(pkgName)) {
      return miniprogramDirCache.get(pkgName)
    }
    try {
      const packageJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [cwd] })
      const raw = fs.readJsonSync(packageJsonPath, { throws: false }) as { miniprogram?: unknown } | undefined
      const miniprogram = typeof raw?.miniprogram === 'string' ? raw.miniprogram.trim() : undefined
      const normalized = miniprogram?.replace(TRAILING_RELATIVE_PREFIX_RE, '').replace(TRAILING_SLASH_RE, '')
      miniprogramDirCache.set(pkgName, normalized || undefined)
      return normalized || undefined
    }
    catch {
      miniprogramDirCache.set(pkgName, undefined)
      return undefined
    }
  }

  function getPackageRoot(pkgName: string, cwd: string) {
    try {
      const packageJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [cwd] })
      return path.dirname(packageJsonPath)
    }
    catch {
      return undefined
    }
  }

  function resolveNavigationImport(from: string) {
    const configService = state.ctx.configService
    const cwd = configService?.cwd
    if (!cwd) {
      return undefined
    }

    const parsed = parseNpmPackageSpecifier(from)
    if (!parsed?.packageName || !parsed.subPath) {
      return undefined
    }

    const miniprogramDir = getMiniprogramDir(parsed.packageName, cwd)
    const withMiniprogramSubpath = miniprogramDir && !parsed.subPath.startsWith(`${miniprogramDir}/`) && parsed.subPath !== miniprogramDir
      ? `${miniprogramDir}/${parsed.subPath}`
      : parsed.subPath
    const withMiniprogramDir = `${parsed.packageName}/${withMiniprogramSubpath}`

    const pkgRoot = getPackageRoot(parsed.packageName, cwd)
    if (pkgRoot) {
      const dtsCandidates = [
        path.join(pkgRoot, `${withMiniprogramSubpath}.d.ts`),
        path.join(pkgRoot, withMiniprogramSubpath, 'index.d.ts'),
      ]
      if (dtsCandidates.some(candidate => fs.pathExistsSync(candidate))) {
        return withMiniprogramDir
      }
    }

    const candidates: string[] = []
    if (!SCRIPT_OR_DTS_EXTENSION_RE.test(withMiniprogramDir)) {
      candidates.push(withMiniprogramDir)
      candidates.push(`${withMiniprogramDir}.js`)
      candidates.push(`${withMiniprogramDir}/index.js`)
    }
    else {
      candidates.push(withMiniprogramDir)
    }

    for (const candidate of candidates) {
      try {
        require.resolve(candidate, { paths: [cwd] })
        return candidate
      }
      catch {
        // 继续尝试下一个候选路径
      }
    }

    return undefined
  }

  function collectResolverComponents(): Record<string, string> {
    return Object.fromEntries([
      ...state.resolvedResolverComponents,
      ...supportFileResolverComponents,
    ])
  }

  function collectRuntimeResolverComponents(): Record<string, string> {
    return Object.fromEntries(state.resolvedResolverComponents)
  }

  function collectManifestResolverComponents(): Record<string, string> {
    return supportFileResolverComponents.size > 0
      ? collectResolverComponents()
      : collectRuntimeResolverComponents()
  }

  function clearResolveCache() {
    resolveCache.clear()
    compiledResolversCache = undefined
  }

  function hasSameEntries(target: Map<string, string>, source: Record<string, string>) {
    const entries = Object.entries(source)
    if (target.size !== entries.length) {
      return false
    }
    return entries.every(([name, from]) => target.get(name) === from)
  }

  function setSupportFileResolverComponents(components: Record<string, string>) {
    if (hasSameEntries(supportFileResolverComponents, components)) {
      return false
    }
    supportFileResolverComponents.clear()
    for (const [name, from] of Object.entries(components)) {
      supportFileResolverComponents.set(name, from)
    }
    return true
  }

  function clearSupportFileResolverComponents() {
    if (supportFileResolverComponents.size === 0) {
      return false
    }
    supportFileResolverComponents.clear()
    return true
  }

  function collectStaticResolverComponentsForSupportFiles(): Record<string, string> {
    const resolvers = getAutoImportConfig(state.ctx.configService)?.resolvers
    if (!Array.isArray(resolvers)) {
      return {}
    }

    const allComponents = new Map<string, string>()
    for (const resolver of resolvers) {
      if (getSupportFilesStrategy(resolver) !== 'full') {
        continue
      }

      for (const [name, from] of Object.entries((resolver as any)?.components ?? {})) {
        if (typeof from === 'string') {
          allComponents.set(name, from)
        }
      }
    }

    return Object.fromEntries(allComponents)
  }

  function syncResolverComponentProps() {
    const resolverEntries = collectResolverComponents()
    state.resolverComponentsMapRef.value = resolverEntries
    state.resolverComponentNames.clear()
    for (const name of Object.keys(resolverEntries)) {
      state.resolverComponentNames.add(name)
      if (!state.componentMetadataMap.has(name)) {
        state.componentMetadataMap.set(name, { types: new Map(), docs: new Map() })
      }
    }
    for (const key of Array.from(state.componentMetadataMap.keys())) {
      if (state.resolverComponentNames.has(key)) {
        continue
      }
      if (state.registry.has(key)) {
        continue
      }
      state.componentMetadataMap.delete(key)
    }
  }

  function resolveWithResolvers(componentName: string, importerBaseName?: string): ResolvedValue | undefined {
    const cacheKey = getResolveCacheKey(componentName, importerBaseName)
    if (resolveCache.has(cacheKey)) {
      const cached = resolveCache.get(cacheKey)
      return cached ?? undefined
    }

    const resolvers = getAutoImportConfig(state.ctx.configService)?.resolvers
    if (!Array.isArray(resolvers)) {
      resolveCache.set(cacheKey, null)
      return undefined
    }

    for (const step of getCompiledResolvers(resolvers)) {
      if (step.kind === 'static') {
        const components = step.components ?? {}
        for (const candidate of toComponentCandidates(componentName)) {
          const from = components[candidate]
          if (from) {
            const value = { name: componentName, from }
            resolveCache.set(cacheKey, value)
            return value
          }
        }
        continue
      }

      if (!step.resolver) {
        continue
      }
      const value = resolveWithResolver(step.resolver, componentName, importerBaseName ?? '')
      if (value) {
        resolveCache.set(cacheKey, value)
        return value
      }
    }

    resolveCache.set(cacheKey, null)
    return undefined
  }

  return {
    collectResolverComponents,
    collectRuntimeResolverComponents,
    collectManifestResolverComponents,
    clearResolveCache,
    syncResolverComponentProps,
    setSupportFileResolverComponents,
    clearSupportFileResolverComponents,
    collectStaticResolverComponentsForSupportFiles,
    resolveWithResolvers,
    resolveNavigationImport,
  }
}

interface CompiledResolverStep {
  kind: 'static' | 'dynamic'
  components?: Record<string, string>
  resolver?: Resolver
}

interface CompiledResolversCache {
  source: Resolver[]
  steps: CompiledResolverStep[]
}
