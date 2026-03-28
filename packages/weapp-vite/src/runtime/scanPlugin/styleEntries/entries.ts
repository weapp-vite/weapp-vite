import type { MutableCompilerContext } from '../../../context'
import type { SubPackageStyleEntry } from '../../../types'
import type { ResolvedStyleConfig } from './config'
import fs from 'node:fs'
import path from 'pathe'
import logger from '../../../logger'
import { changeFileExtension, toPosixPath } from '../../../utils'
import {
  DEFAULT_SCOPED_EXTENSIONS,
  DEFAULT_SCOPED_FILES,

} from './config'
import { resolveExcludePatterns, resolveIncludePatterns } from './patterns'

export function createStyleEntryDedupeKey(
  posixOutput: string,
  include: string[],
  exclude: string[],
) {
  return JSON.stringify({
    file: posixOutput,
    include,
    exclude,
  })
}

export function resolveDefaultScopedStyleEntryCandidates(
  absoluteSrcRoot: string,
  root: string,
) {
  const absoluteSubRoot = path.resolve(absoluteSrcRoot, root)

  return DEFAULT_SCOPED_FILES.flatMap(({ base, scope }) =>
    DEFAULT_SCOPED_EXTENSIONS.map(ext => ({
      base,
      scope,
      filename: `${base}${ext}`,
      absolutePath: path.resolve(absoluteSubRoot, `${base}${ext}`),
    })),
  )
}

export function addStyleEntry(
  descriptor: ResolvedStyleConfig,
  absolutePath: string,
  posixOutput: string,
  root: string,
  normalizedRoot: string,
  dedupe: Set<string>,
  normalized: SubPackageStyleEntry[],
) {
  const include = resolveIncludePatterns({ scope: descriptor.scope, include: descriptor.include }, normalizedRoot)
  const exclude = resolveExcludePatterns({ exclude: descriptor.exclude }, normalizedRoot)
  include.sort()
  exclude.sort()

  if (!include.length) {
    logger.warn(`[分包] 分包 ${root} 样式入口 \`${descriptor.source}\` 缺少有效作用范围，已按 \`**/*\` 处理。`)
    include.push('**/*')
  }

  const key = createStyleEntryDedupeKey(posixOutput, include, exclude)
  if (dedupe.has(key)) {
    return
  }
  dedupe.add(key)

  normalized.push({
    source: descriptor.source,
    absolutePath,
    outputRelativePath: posixOutput,
    inputExtension: path.extname(absolutePath).toLowerCase(),
    scope: descriptor.scope,
    include,
    exclude,
  })
}

export function appendDefaultScopedStyleEntries(
  root: string,
  normalizedRoot: string,
  service: NonNullable<MutableCompilerContext['configService']>,
  dedupe: Set<string>,
  normalized: SubPackageStyleEntry[],
) {
  let previousBase = ''
  let matchedCurrentBase = false

  for (const candidate of resolveDefaultScopedStyleEntryCandidates(service.absoluteSrcRoot, root)) {
    if (candidate.base !== previousBase) {
      previousBase = candidate.base
      matchedCurrentBase = false
    }
    if (matchedCurrentBase || !fs.existsSync(candidate.absolutePath)) {
      continue
    }

    const descriptor: ResolvedStyleConfig = {
      source: candidate.filename,
      scope: candidate.scope,
      include: undefined,
      exclude: undefined,
      explicitScope: true,
    }
    const outputAbsolutePath = changeFileExtension(candidate.absolutePath, service.outputExtensions.wxss)
    const outputRelativePath = service.relativeOutputPath(outputAbsolutePath)
    if (!outputRelativePath) {
      continue
    }
    const posixOutput = toPosixPath(outputRelativePath)
    addStyleEntry(descriptor, candidate.absolutePath, posixOutput, root, normalizedRoot, dedupe, normalized)
    matchedCurrentBase = true
  }
}
