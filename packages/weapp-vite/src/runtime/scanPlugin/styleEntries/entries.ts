import type { MutableCompilerContext } from '../../../context'
import type { SubPackageStyleEntry } from '../../../types'
import type { ResolvedStyleConfig } from './config'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../../../logger'
import { changeFileExtension, toPosixPath } from '../../../utils'
import {
  DEFAULT_SCOPED_EXTENSIONS,
  DEFAULT_SCOPED_FILES,

} from './config'
import { resolveExcludePatterns, resolveIncludePatterns } from './patterns'

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

  const key = JSON.stringify({
    file: posixOutput,
    include,
    exclude,
  })
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
  const absoluteSubRoot = path.resolve(service.absoluteSrcRoot, root)
  for (const { base, scope } of DEFAULT_SCOPED_FILES) {
    for (const ext of DEFAULT_SCOPED_EXTENSIONS) {
      const filename = `${base}${ext}`
      const absolutePath = path.resolve(absoluteSubRoot, filename)
      if (!fs.existsSync(absolutePath)) {
        continue
      }
      const descriptor: ResolvedStyleConfig = {
        source: filename,
        scope,
        include: undefined,
        exclude: undefined,
        explicitScope: true,
      }
      const outputAbsolutePath = changeFileExtension(absolutePath, service.outputExtensions.wxss)
      const outputRelativePath = service.relativeOutputPath(outputAbsolutePath)
      if (!outputRelativePath) {
        continue
      }
      const posixOutput = toPosixPath(outputRelativePath)
      addStyleEntry(descriptor, absolutePath, posixOutput, root, normalizedRoot, dedupe, normalized)
      break
    }
  }
}
