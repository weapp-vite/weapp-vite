import type { MutableCompilerContext } from '../../context'
import type { ChangeEvent } from '../../types'
import type { CandidateEntry } from './candidates'
import { removeExtensionDeep } from '@weapp-core/shared'
import { findCssEntry, findJsEntry, findJsonEntry, findTemplateEntry, findVueEntry } from '../../utils/file'
import {
  isConfigFile,
  isScriptFile,
  isStyleFile,
  isTemplateFile,
  isVueFile,
} from './candidates'
import { isAutoRoutesGeneratedPath, resolveAutoRoutesManagedOutputPaths } from './generatedPaths'
import { resolveRoute } from './routes'
import {
  isAutoRoutesCandidateUnchanged,
  resolveAutoRoutesBasePath,
  resolveAutoRoutesMatcherContext,
  resolveAutoRoutesPath,
  shouldAutoRoutesFullRescan,
  shouldRemoveAutoRoutesCandidate,
} from './shared'

export type AutoRoutesFileEvent = ChangeEvent | 'rename'

export function matchesRouteFile(
  ctx: MutableCompilerContext,
  candidate: string,
) {
  const configService = ctx.configService
  if (!configService) {
    return false
  }

  if (isAutoRoutesGeneratedPath(candidate, {
    cwd: configService.cwd,
    absoluteSrcRoot: configService.absoluteSrcRoot,
    managedOutputPaths: resolveAutoRoutesManagedOutputPaths(ctx),
  })) {
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

  const { matcher } = resolveAutoRoutesMatcherContext(ctx)
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
  const [
    vueEntry,
    jsEntry,
    templateEntry,
    styleEntry,
    jsonEntry,
  ] = await Promise.all([
    findVueEntry(base),
    findJsEntry(base),
    findTemplateEntry(base),
    findCssEntry(base),
    findJsonEntry(base),
  ])

  if (vueEntry) {
    files.add(vueEntry)
    hasScript = true
  }

  const { path: jsEntryPath } = jsEntry
  if (jsEntryPath) {
    files.add(jsEntryPath)
    hasScript = true
  }

  const { path: templateEntryPath } = templateEntry
  if (templateEntryPath) {
    files.add(templateEntryPath)
    hasTemplate = true
  }

  const { path: styleEntryPath } = styleEntry
  if (styleEntryPath) {
    files.add(styleEntryPath)
  }

  const { path: jsonEntryPath } = jsonEntry
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

  if (isAutoRoutesGeneratedPath(filePath, {
    cwd: ctx.configService.cwd,
    absoluteSrcRoot: ctx.configService.absoluteSrcRoot,
    managedOutputPaths: resolveAutoRoutesManagedOutputPaths(ctx),
  })) {
    return false
  }

  if (shouldAutoRoutesFullRescan(event)) {
    markNeedsFullRescan?.()
    return true
  }

  const resolvedBasePath = resolveAutoRoutesBasePath(filePath, {
    cwd: ctx.configService.cwd,
    absoluteSrcRoot: ctx.configService.absoluteSrcRoot,
  })
  if (!resolvedBasePath) {
    markNeedsFullRescan?.()
    return true
  }

  const { base, relativeBase } = resolvedBasePath
  const { matcher, subPackageRoots } = resolveAutoRoutesMatcherContext(ctx)
  const route = resolveRoute(relativeBase, subPackageRoots)
  const matchesInclude = matcher.matches(relativeBase)
  if (shouldRemoveAutoRoutesCandidate({
    hasRouteMatch: Boolean(route),
    matchesInclude,
    hasCandidateEntry: stateCandidates.has(base),
  })) {
    const removed = stateCandidates.delete(base)
    return removed
  }

  const candidate = await rebuildCandidateForBase(base)
  if (!candidate) {
    const removed = stateCandidates.delete(base)
    return removed
  }

  const previous = stateCandidates.get(base)
  if (isAutoRoutesCandidateUnchanged(previous, candidate)) {
    return false
  }

  stateCandidates.set(base, candidate)
  return true
}
