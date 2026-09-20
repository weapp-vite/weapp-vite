import type { AutoRoutes } from '../../../types/routes'
import type { RuntimeState } from '../../runtimeState'
import type { NamedAutoRoute } from '../types'
import { createHash } from 'node:crypto'
import path from 'pathe'
import { createMiniProgramGlobalResolveExpression, getRouteRuntimeGlobalKeys } from '../../../utils/miniProgramGlobals'
import { cloneRoutes, createTypedRouterDefinition, updateRoutesReference } from '../routes'

export interface AutoRoutesPersistentCache {
  version: 3
  snapshot: AutoRoutes
  namedRoutes: NamedAutoRoute[]
  topologyKey: string
  pageDeclarationDependencies: Record<string, string[]>
  pageDeclarationFingerprints: Record<string, string>
  usesOpaquePageDeclarationResolver: boolean
  pageSourceFiles: string[]
  namedRouteSourceFiles: string[]
  watchFiles: string[]
  watchDirs: string[]
  fileMtims: Record<string, number>
}

export const AUTO_ROUTES_CACHE_FILE = '.weapp-vite/auto-routes.cache.json'
export const TYPED_ROUTER_OUTPUT_FILE = '.weapp-vite/typed-router.d.ts'

export function updateWatchTargets(target: Set<string>, next: Set<string>) {
  target.clear()
  for (const item of next) {
    target.add(item)
  }
}

export function updatePageDeclarationDependencies(
  target: Map<string, Set<string>>,
  next: ReadonlyMap<string, ReadonlySet<string>>,
) {
  target.clear()
  for (const [dependency, owners] of next) {
    target.set(dependency, new Set(owners))
  }
}

export function createAutoRoutesSourceFingerprint(source: string) {
  return createHash('sha256').update(source).digest('hex')
}

export function createEmptyAutoRoutesSnapshot(): AutoRoutes {
  return {
    pages: [],
    entries: [],
    subPackages: [],
  }
}

function createAutoRoutesRuntimeLines() {
  const routeRuntimeGlobalExpression = createMiniProgramGlobalResolveExpression({
    globalKeys: getRouteRuntimeGlobalKeys(),
  })
  return [
    'const pages = routes.pages;',
    'const entries = routes.entries;',
    'const subPackages = routes.subPackages;',
    `const resolveMiniProgramGlobal = () => ${routeRuntimeGlobalExpression};`,
    'const callRouteMethod = (methodName, option) => {',
    '  const miniProgramGlobal = resolveMiniProgramGlobal();',
    '  const routeMethod = miniProgramGlobal?.[methodName];',
    '  if (typeof routeMethod !== "function") {',
    '    throw new Error("[weapp-vite] 当前运行环境不支持路由方法: " + methodName);',
    '  }',
    '  if (option === undefined) {',
    '    return routeMethod.call(miniProgramGlobal);',
    '  }',
    '  return routeMethod.call(miniProgramGlobal, option);',
    '};',
    'const miniProgramRouter = {',
    '  switchTab(option) { return callRouteMethod("switchTab", option); },',
    '  reLaunch(option) { return callRouteMethod("reLaunch", option); },',
    '  redirectTo(option) { return callRouteMethod("redirectTo", option); },',
    '  navigateTo(option) { return callRouteMethod("navigateTo", option); },',
    '  navigateBack(option) { return callRouteMethod("navigateBack", option); },',
    '};',
    'const wxRouter = miniProgramRouter;',
    'export { routes, pages, entries, subPackages, wxRouter, miniProgramRouter };',
    'export default routes;',
  ]
}

export function createAutoRoutesModuleCode(serialized: string) {
  return [
    'const routes = ',
    serialized,
    ';',
    ...createAutoRoutesRuntimeLines(),
  ].join('\n')
}

export function createNamedAutoRoutesModuleCode(serialized: string) {
  return `export const routes = JSON.parse(${JSON.stringify(serialized)});\n`
}

export function createAutoRoutesArtifacts(snapshot: AutoRoutes, namedRoutes: NamedAutoRoute[] = []) {
  const serialized = JSON.stringify(snapshot, null, 2)
  const namedRoutesSerialized = JSON.stringify(namedRoutes, null, 2)
  return {
    serialized,
    moduleCode: createAutoRoutesModuleCode(serialized),
    namedModuleCode: createNamedAutoRoutesModuleCode(namedRoutesSerialized),
    signature: JSON.stringify({ routes: snapshot, namedRoutes }),
    typedDefinition: createTypedRouterDefinition(snapshot, namedRoutes),
  }
}

export function resetAutoRoutesState(state: RuntimeState['autoRoutes']) {
  const emptySnapshot = createEmptyAutoRoutesSnapshot()
  const artifacts = createAutoRoutesArtifacts(emptySnapshot)
  updateRoutesReference(state.routes, emptySnapshot)
  state.namedRoutes = []
  state.serialized = artifacts.serialized
  state.typedDefinition = artifacts.typedDefinition
  state.moduleCode = artifacts.moduleCode
  state.namedModuleCode = artifacts.namedModuleCode
  state.signature = artifacts.signature
  state.topologyKey = ''
  state.pageDeclarationDependencies.clear()
  state.pageDeclarationFingerprints.clear()
  state.usesOpaquePageDeclarationResolver = false
  updateWatchTargets(state.pageSourceFiles, new Set())
  updateWatchTargets(state.namedRouteSourceFiles, new Set())
  updateWatchTargets(state.watchFiles, new Set())
  updateWatchTargets(state.watchDirs, new Set())
  state.dirty = false
  state.initialized = true
  state.candidates.clear()
  state.needsFullRescan = true
}

export function resolveTypedRouterOutputPath(configService: Pick<RuntimeState['config']['options'], 'configFilePath' | 'cwd'>) {
  const baseDir = typeof configService.configFilePath === 'string'
    ? path.dirname(configService.configFilePath)
    : configService.cwd
  return path.resolve(baseDir, TYPED_ROUTER_OUTPUT_FILE)
}

export function resolvePersistentCacheBaseDir(configService: Pick<RuntimeState['config']['options'], 'configFilePath' | 'cwd'>) {
  const baseDir = typeof configService.configFilePath === 'string'
    ? path.dirname(configService.configFilePath)
    : configService.cwd

  return baseDir || undefined
}

export function applyPersistentCache(state: RuntimeState['autoRoutes'], cache: AutoRoutesPersistentCache) {
  const artifacts = createAutoRoutesArtifacts(cache.snapshot, cache.namedRoutes)
  updateRoutesReference(state.routes, cache.snapshot)
  state.namedRoutes = cache.namedRoutes
  state.serialized = artifacts.serialized
  state.moduleCode = artifacts.moduleCode
  state.namedModuleCode = artifacts.namedModuleCode
  state.signature = `${artifacts.signature}\n${cache.topologyKey}`
  state.typedDefinition = artifacts.typedDefinition
  state.topologyKey = cache.topologyKey
  updatePageDeclarationDependencies(
    state.pageDeclarationDependencies,
    new Map(Object.entries(cache.pageDeclarationDependencies).map(([dependency, owners]) => [
      dependency,
      new Set(owners),
    ])),
  )
  state.pageDeclarationFingerprints.clear()
  for (const [sourceFile, fingerprint] of Object.entries(cache.pageDeclarationFingerprints)) {
    state.pageDeclarationFingerprints.set(sourceFile, fingerprint)
  }
  state.usesOpaquePageDeclarationResolver = cache.usesOpaquePageDeclarationResolver
  updateWatchTargets(state.pageSourceFiles, new Set(cache.pageSourceFiles))
  updateWatchTargets(state.namedRouteSourceFiles, new Set(cache.namedRouteSourceFiles))
  updateWatchTargets(state.watchFiles, new Set(cache.watchFiles))
  updateWatchTargets(state.watchDirs, new Set(cache.watchDirs))
  state.dirty = false
  state.initialized = true
  state.needsFullRescan = false
}

export function createPersistentCachePayload(
  state: RuntimeState['autoRoutes'],
  fileMtims: Record<string, number>,
): AutoRoutesPersistentCache {
  return {
    version: 3,
    snapshot: cloneRoutes(state.routes),
    namedRoutes: state.namedRoutes,
    topologyKey: state.topologyKey,
    pageDeclarationDependencies: Object.fromEntries(
      [...state.pageDeclarationDependencies].map(([dependency, owners]) => [dependency, [...owners]]),
    ),
    pageDeclarationFingerprints: Object.fromEntries(state.pageDeclarationFingerprints),
    usesOpaquePageDeclarationResolver: state.usesOpaquePageDeclarationResolver,
    pageSourceFiles: [...state.pageSourceFiles],
    namedRouteSourceFiles: [...state.namedRouteSourceFiles],
    watchFiles: [...state.watchFiles],
    watchDirs: [...state.watchDirs],
    fileMtims,
  }
}
