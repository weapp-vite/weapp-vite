import type { AutoRoutes } from '../../types/routes'
import type { RuntimeState } from '../runtimeState'
import path from 'pathe'
import { cloneRoutes, createTypedRouterDefinition, updateRoutesReference } from '../routes'

export interface AutoRoutesPersistentCache {
  version: 1
  snapshot: AutoRoutes
  serialized: string
  moduleCode: string
  typedDefinition: string
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

export function createEmptyAutoRoutesSnapshot(): AutoRoutes {
  return {
    pages: [],
    entries: [],
    subPackages: [],
  }
}

export function createAutoRoutesModuleCode(serialized: string) {
  return [
    'const routes = ',
    serialized,
    ';',
    'const pages = routes.pages;',
    'const entries = routes.entries;',
    'const subPackages = routes.subPackages;',
    'const resolveMiniProgramGlobal = () => (globalThis.wx ?? globalThis.tt ?? globalThis.my);',
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
    'const wxRouter = {',
    '  switchTab(option) { return callRouteMethod("switchTab", option); },',
    '  reLaunch(option) { return callRouteMethod("reLaunch", option); },',
    '  redirectTo(option) { return callRouteMethod("redirectTo", option); },',
    '  navigateTo(option) { return callRouteMethod("navigateTo", option); },',
    '  navigateBack(option) { return callRouteMethod("navigateBack", option); },',
    '};',
    'export { routes, pages, entries, subPackages, wxRouter };',
    'export default routes;',
  ].join('\n')
}

export function resetAutoRoutesState(state: RuntimeState['autoRoutes']) {
  const emptySnapshot = createEmptyAutoRoutesSnapshot()
  updateRoutesReference(state.routes, emptySnapshot)
  state.serialized = JSON.stringify(emptySnapshot, null, 2)
  state.typedDefinition = createTypedRouterDefinition(emptySnapshot)
  state.moduleCode = createAutoRoutesModuleCode(state.serialized)
  updateWatchTargets(state.watchFiles, new Set())
  updateWatchTargets(state.watchDirs, new Set())
  state.dirty = false
  state.initialized = true
  state.candidates.clear()
  state.needsFullRescan = true
}

export function resolveTypedRouterOutputPath(configService: RuntimeState['config']['options']) {
  const baseDir = typeof configService.configFilePath === 'string'
    ? path.dirname(configService.configFilePath)
    : configService.cwd
  return path.resolve(baseDir, TYPED_ROUTER_OUTPUT_FILE)
}

export function resolvePersistentCacheBaseDir(configService: RuntimeState['config']['options']) {
  const baseDir = typeof configService.configFilePath === 'string'
    ? path.dirname(configService.configFilePath)
    : configService.cwd

  return baseDir || undefined
}

export function applyPersistentCache(state: RuntimeState['autoRoutes'], cache: AutoRoutesPersistentCache) {
  const watchFiles = Array.isArray(cache.watchFiles) ? cache.watchFiles : []
  updateRoutesReference(state.routes, cache.snapshot)
  state.serialized = cache.serialized
  state.moduleCode = cache.moduleCode
  state.typedDefinition = cache.typedDefinition
  updateWatchTargets(state.watchFiles, new Set(watchFiles))
  updateWatchTargets(state.watchDirs, new Set(Array.isArray(cache.watchDirs) ? cache.watchDirs : []))
  state.dirty = false
  state.initialized = true
  state.needsFullRescan = true
}

export function createPersistentCachePayload(state: RuntimeState['autoRoutes'], fileMtims: Record<string, number>): AutoRoutesPersistentCache {
  return {
    version: 1,
    snapshot: cloneRoutes(state.routes),
    serialized: state.serialized,
    moduleCode: state.moduleCode,
    typedDefinition: state.typedDefinition,
    watchFiles: [...state.watchFiles],
    watchDirs: [...state.watchDirs],
    fileMtims,
  }
}
