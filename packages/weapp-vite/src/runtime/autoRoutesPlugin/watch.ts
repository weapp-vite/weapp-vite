import type { MutableCompilerContext } from '../../context'
import type { ChangeEvent } from '../../types'
import type { CandidateEntry } from './candidates'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
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
import { resolveRoute } from './routes'

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

  const normalizedSrcRoot = normalizePath(configService.absoluteSrcRoot)
  const normalizedCandidate = normalizePath(
    path.isAbsolute(pathWithoutQuery)
      ? pathWithoutQuery
      : path.resolve(configService.cwd, pathWithoutQuery),
  )
  const relative = toPosixPath(path.relative(normalizedSrcRoot, normalizedCandidate))
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return false
  }

  const isPagesPath = relative.startsWith('pages/')
    || relative.includes('/pages/')

  if (!isPagesPath) {
    return false
  }

  if (isConfigFile(normalizedCandidate)) {
    return true
  }

  if (
    isVueFile(normalizedCandidate)
    || isScriptFile(normalizedCandidate)
    || isTemplateFile(normalizedCandidate)
    || isStyleFile(normalizedCandidate)
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

  const route = resolveRoute(relativeBase)
  if (!route) {
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
