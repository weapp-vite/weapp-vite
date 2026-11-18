import type { NamedRouteLookup, RouteResolveCodec } from '../routerInternal/shared'
import type { RouterHistory } from './history'
import type { RouteRegistry } from './routeRegistry'
import type {
  InitialNavigationMode,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
  UseRouterOptions,
} from './types'
import {
  cloneRouteMeta,
  cloneRouteParams,
  createNamedRouteLookup,
  createRouterOptionsSnapshot,
  mergeMatchedRouteMeta,
  normalizeRouteRecordMatched,
  parseQuery,
  resolveMatchedRouteRecord,
  resolveNamedRouteLocation,
  resolvePath,
  resolveRouteOptionEntries,
  stringifyQuery,
  warnDuplicateRouteEntries,
} from '../routerInternal/shared'
import { getCurrentMiniProgramTabBarPagePaths } from '../runtime/platform'
import { createMiniProgramHistory } from './historyDriver'
import { DEFAULT_INITIAL_NAVIGATION_TIMEOUT } from './initialNavigation'
import { resolveRouteLocation } from './resolve'
import { createRouteRegistry } from './routeRegistry'

/**
 * 归一化后的运行时配置与路由表。
 *
 * 默认值、平台兜底、重复路由告警与命名路由解析都在这里一次性完成，
 * 导航内核只消费这一份结果，避免同一组依赖在多层之间重复列举。
 */
export interface RouterRuntime {
  /** 历史驱动。 */
  readonly history: RouterHistory
  /** 是否与原生同步。 */
  readonly syncWithNative: boolean
  /** 单次导航允许的最大重定向次数。 */
  readonly maxRedirects: number
  /** 首屏导航守卫模式。 */
  readonly initialNavigationMode: InitialNavigationMode
  /** blocking 首屏导航守卫的最大等待时间（毫秒）。 */
  readonly initialNavigationTimeout: number
  /** 异常型导航失败是否以 Promise reject 抛出。 */
  readonly rejectOnError: boolean
  /** query 编解码器。 */
  readonly routeResolveCodec: RouteResolveCodec
  /** tabBar 页面路径集合。 */
  readonly tabBarPaths: ReadonlySet<string>
  /** 命名路由索引。 */
  readonly namedRouteLookup: NamedRouteLookup
  /** 可动态增删的路由表。 */
  readonly routeRegistry: RouteRegistry
  /** 补全匹配记录、名称、元信息与参数。 */
  readonly enrich: (route: RouteLocationNormalizedLoaded) => RouteLocationNormalizedLoaded
  /** 解析目标位置：原始位置 → 标准化位置。 */
  readonly resolveWithCodec: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded
  /** 公开只读配置快照。 */
  readonly snapshot: Readonly<UseRouterOptions>
}

/** 建立运行时配置与命名路由表。 */
export function createRouterRuntime(options: UseRouterOptions): RouterRuntime {
  const history = options.history ?? createMiniProgramHistory()
  const syncWithNative = history.syncWithNative !== false
  const maxRedirects = options.maxRedirects ?? 10
  const initialNavigationMode: InitialNavigationMode = options.initialNavigationMode === 'blocking' ? 'blocking' : 'eager'
  const initialNavigationTimeout = Number.isFinite(options.initialNavigationTimeout) && (options.initialNavigationTimeout ?? 0) > 0
    ? Math.max(1, Math.trunc(options.initialNavigationTimeout!))
    : DEFAULT_INITIAL_NAVIGATION_TIMEOUT
  const paramsMode = options.paramsMode ?? 'loose'
  const rejectOnError = options.rejectOnError ?? true
  const routeResolveCodec: RouteResolveCodec = {
    parseQuery: options.parseQuery ?? parseQuery,
    stringifyQuery: options.stringifyQuery ?? stringifyQuery,
  }
  const routeEntries = resolveRouteOptionEntries(options)
  warnDuplicateRouteEntries(routeEntries)
  const namedRouteLookup = createNamedRouteLookup(routeEntries)
  const tabBarEntrySource = options.tabBarEntries ?? getCurrentMiniProgramTabBarPagePaths()
  const normalizedTabBarEntries = tabBarEntrySource
    .map(path => resolvePath(path, ''))
    .filter(Boolean)
  const tabBarPaths = new Set(normalizedTabBarEntries)
  const routeRegistry = createRouteRegistry(namedRouteLookup)

  /** 补全匹配记录、名称、元信息与参数。 */
  function enrich(routeLocation: RouteLocationNormalizedLoaded): RouteLocationNormalizedLoaded {
    const resolved = { ...routeLocation }
    resolved.href = resolved.fullPath
    const matchedResult = resolveMatchedRouteRecord(resolved, namedRouteLookup)
    if (matchedResult) {
      const matchedRecord = matchedResult.record
      if (resolved.name === undefined) {
        resolved.name = matchedRecord.name
      }
      const mergedRouteMeta = mergeMatchedRouteMeta(matchedResult.matchedRecords)
      if (mergedRouteMeta !== undefined) {
        resolved.meta = cloneRouteMeta(mergedRouteMeta)
      }
      if (matchedResult.params && Object.keys(resolved.params).length === 0) {
        resolved.params = cloneRouteParams(matchedResult.params)
      }
      resolved.matched = matchedResult.matchedRecords.map((record, index, records) => {
        const leafMatchedPath = index === records.length - 1
          ? matchedResult.matchedPath
          : undefined
        return normalizeRouteRecordMatched(record, leafMatchedPath)
      })
    }
    else {
      resolved.matched = []
    }
    return resolved
  }

  /** 解析目标位置：原始位置 → 标准化位置。 */
  function resolveWithCodec(to: RouteLocationRaw, currentPath: string): RouteLocationNormalizedLoaded {
    const rawTo = typeof to === 'string'
      ? to
      : resolveNamedRouteLocation(to, namedRouteLookup, paramsMode)
    return enrich(resolveRouteLocation(rawTo, currentPath, routeResolveCodec))
  }

  const snapshot = createRouterOptionsSnapshot(
    normalizedTabBarEntries,
    routeRegistry.getRoutes(),
    paramsMode,
    maxRedirects,
    initialNavigationMode,
    initialNavigationTimeout,
    routeResolveCodec,
    rejectOnError,
  )

  return {
    history,
    syncWithNative,
    maxRedirects,
    initialNavigationMode,
    initialNavigationTimeout,
    rejectOnError,
    routeResolveCodec,
    tabBarPaths,
    namedRouteLookup,
    routeRegistry,
    enrich,
    resolveWithCodec,
    snapshot,
  }
}
