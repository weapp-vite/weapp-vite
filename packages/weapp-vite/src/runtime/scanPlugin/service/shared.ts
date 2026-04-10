import type { App as AppJson, Plugin as PluginJson } from '@weapp-core/schematics'
import type { AppEntry } from '../../../types'
import logger from '../../../logger'
import { normalizeRoot, toPosixPath } from '../../../utils/path'

export interface ScanServiceStateLike {
  appEntry?: AppEntry
  pluginJson?: PluginJson
  pluginJsonPath?: string
  warnedMessages: Set<string>
  independentSubPackageMap: Map<string, any>
  independentDirtyRoots: Set<string>
  isDirty: boolean
}

export function createWarnOnce(warnedMessages: Set<string>) {
  return function warnOnce(message: string) {
    if (warnedMessages.has(message)) {
      return
    }
    warnedMessages.add(message)
    logger.warn(message)
  }
}

export function mergeAutoRoutePages(
  pages: AppJson['pages'] | undefined,
  routePages: string[],
) {
  if (routePages.length === 0) {
    return pages
  }

  const existingPages = Array.isArray(pages) ? pages.filter(page => typeof page === 'string' && page.length > 0) : []
  const existingSet = new Set(existingPages)
  const hasAllRoutePages = routePages.every(page => existingSet.has(page))
  if (hasAllRoutePages) {
    return existingPages
  }

  return [
    ...routePages,
    ...existingPages.filter(page => !routePages.includes(page)),
  ]
}

export function isMainPackageFileName(fileName: string, independentSubPackageMap: Map<string, any>) {
  const normalizedFileName = toPosixPath(fileName)
  return [...independentSubPackageMap.keys()].every((root) => {
    return !normalizedFileName.startsWith(root)
  })
}

export function markIndependentDirty(root: string, independentSubPackageMap: Map<string, any>, independentDirtyRoots: Set<string>) {
  if (!root) {
    return
  }
  const normalizedRoot = normalizeRoot(root)
  if (independentSubPackageMap.has(normalizedRoot)) {
    independentDirtyRoots.add(normalizedRoot)
  }
}

export function drainIndependentDirtyRoots(independentDirtyRoots: Set<string>) {
  const roots = [...independentDirtyRoots]
  independentDirtyRoots.clear()
  return roots
}
