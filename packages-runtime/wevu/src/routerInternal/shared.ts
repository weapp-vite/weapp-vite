export {
  createRouteLocation,
  parsePathInput,
  resolveCurrentRoute,
} from './location'
export {
  collectRouteNamesForRemoval,
  mergeMatchedRouteMeta,
  resolveMatchedRouteRecord,
} from './matching'
export {
  decodeRouteParamSegment,
  parsePathParamToken,
  resolveNamedRouteLocation,
} from './params'
export {
  createAbsoluteRoutePath,
  isDynamicRoutePath,
  resolvePath,
} from './path'
export {
  normalizeHash,
  normalizeQuery,
  normalizeRouteParams,
  parseQuery,
  stringifyQuery,
} from './query'
export {
  createNamedRouteLookup,
  createNamedRouteNameByStaticPath,
  createRouteRecordAliasValue,
  flattenNamedRouteRecords,
  normalizeRouteRecordRaw,
  resolveRouteOptionEntries,
} from './records'
export {
  assertValidAddRouteInput,
  warnDuplicateRouteEntries,
  warnRouteConfig,
} from './recordsWarnings'
export {
  cloneLocationQuery,
  cloneRouteLocationRedirectedFrom,
  cloneRouteMeta,
  cloneRouteParams,
  cloneRouteRecordMatchedList,
  createNativeRouteUrl,
  createRedirectedFromSnapshot,
  createRouterOptionsSnapshot,
  hasLocationQuery,
  normalizeRouteRecordMatched,
  snapshotRouteLocation,
} from './snapshots'

export type {
  FlattenedRouteRecordSeed,
  MatchedRouteRecordResolveResult,
  MiniProgramPageLike,
  NamedRouteLookup,
  NamedRoutePathResolveResult,
  PathParamToken,
  RouteOptionSource,
  RouteRecordNormalized,
  RouteResolveCodec,
} from './types'
