import type { MutableCompilerContext } from '../../context'
import type { ChangeEvent } from '../../types'
import type { CandidateEntry } from './candidates'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { resolveWeappAutoRoutesConfig } from '../../autoRoutesConfig'
import { findCssEntry, findJsEntry, findJsonEntry, findTemplateEntry, findVueEntry } from '../../utils/file'
import { normalizePath, toPosixPath } from '../../utils/path'
import {
  areSetsEqual,
  isConfigFile,
  isScriptFile,
  isStyleFile,
  isTemplateFile,
  isVueFile,
} from './candidates'
import { createAutoRoutesMatcher } from './matcher'
import { resolveRoute } from './routes'
import { resolveAutoRoutesPath } from './shared'
import { getAutoRoutesSubPackageRoots } from './subPackageRoots'

export type AutoRoutesFileEvent = ChangeEvent | 'rename'

export function matchesRouteFile(
  ctx: MutableCompilerContext,
  candidate: string,
) {
  const configService = ctx.configService
  if (!configService) {
    return false
  }

  const [pathWithoutQuery] = candidate.split('?')
  if (!pathWithoutQuery) {
    return false
  }

  const resolvedPath = resolveAutoRoutesPath(candidate, {
    cwd: configService.cwd,
    absoluteSrcRoot: configService.absoluteSrcRoot,
  })
  if (!resolvedPath) {
    return false
  }

  const autoRoutesConfig = resolveWeappAutoRoutesConfig(configService.weappViteConfig?.autoRoutes)
  const subPackageRoots = getAutoRoutesSubPackageRoots(ctx)
  const matcher = createAutoRoutesMatcher(autoRoutesConfig.include, subPackageRoots)
  if (!matcher.matches(removeExtensionDeep(resolvedPath.relativePath))) {
    return false
  }

  if (isConfigFile(resolvedPath.absolutePath)) {
    return true
  }

  if (
    isVueFile(resolvedPath.absolutePath)
    || isScriptFile(resolvedPath.absolutePath)
    || isTemplateFile(resolvedPath.absolutePath)
    || isStyleFile(resolvedPath.absolutePath)
  ) {
    return true
  }

  return false
}

async function rebuildCandidateForBase(base: string): Promise<CandidateEntry | undefined> {
  const files = new Set<string>()
  let hasScript = false
  let hasTemplate = false
  let jsonPath: string | undefined

  const vueEntry = await findVueEntry(base)
  if (vueEntry) {
    files.add(vueEntry)
    hasScript = true
  }

  const { path: jsEntryPath } = await findJsEntry(base)
  if (jsEntryPath) {
    files.add(jsEntryPath)
    hasScript = true
  }

  const { path: templateEntryPath } = await findTemplateEntry(base)
  if (templateEntryPath) {
    files.add(templateEntryPath)
    hasTemplate = true
  }

  const { path: styleEntryPath } = await findCssEntry(base)
  if (styleEntryPath) {
    files.add(styleEntryPath)
  }

  const { path: jsonEntryPath } = await findJsonEntry(base)
  if (jsonEntryPath) {
    files.add(jsonEntryPath)
    jsonPath = jsonEntryPath
  }

  if (!files.size && !jsonPath) {
    return undefined
  }

  return {
    base,
    files,
    hasScript,
    hasTemplate,
    jsonPath,
  }
}

export async function updateCandidateFromFile(
  ctx: MutableCompilerContext,
  stateCandidates: Map<string, CandidateEntry>,
  filePath: string,
  event?: AutoRoutesFileEvent,
  markNeedsFullRescan?: () => void,
): Promise<boolean> {
  if (!ctx.configService) {
    return false
  }

  if (event === 'rename' || event === 'create' || event === 'delete') {
    markNeedsFullRescan?.()
    return true
  }

  const [pathWithoutQuery] = filePath.split('?')
  if (!pathWithoutQuery) {
    markNeedsFullRescan?.()
    return true
  }

  const absolutePath = path.isAbsolute(pathWithoutQuery)
    ? pathWithoutQuery
    : path.resolve(ctx.configService.cwd, pathWithoutQuery)
  const normalizedSrcRoot = normalizePath(ctx.configService.absoluteSrcRoot)
  const normalizedAbsolutePath = normalizePath(absolutePath)
  const base = removeExtensionDeep(normalizedAbsolutePath)
  const relativeBase = toPosixPath(path.relative(normalizedSrcRoot, base))
  if (!relativeBase || relativeBase.startsWith('..') || path.isAbsolute(relativeBase)) {
    markNeedsFullRescan?.()
    return true
  }

  const autoRoutesConfig = resolveWeappAutoRoutesConfig(ctx.configService.weappViteConfig?.autoRoutes)
  const subPackageRoots = getAutoRoutesSubPackageRoots(ctx)
  const route = resolveRoute(relativeBase, subPackageRoots)
  if (!route) {
    const removed = stateCandidates.delete(base)
    return removed
  }

  const matcher = createAutoRoutesMatcher(autoRoutesConfig.include, subPackageRoots)
  if (!matcher.matches(relativeBase)) {
    const removed = stateCandidates.delete(base)
    return removed
  }

  const candidate = await rebuildCandidateForBase(base)
  if (!candidate) {
    const removed = stateCandidates.delete(base)
    return removed
  }

  const previous = stateCandidates.get(base)
  if (
    previous
    && previous.jsonPath === candidate.jsonPath
    && previous.hasScript === candidate.hasScript
    && previous.hasTemplate === candidate.hasTemplate
    && areSetsEqual(previous.files, candidate.files)
  ) {
    return false
  }

  stateCandidates.set(base, candidate)
  return true
}
