import type { MutableCompilerContext } from '../../context'
import type {
  SubPackage,
  SubPackageStyleConfigEntry,
  SubPackageStyleEntry,
} from '../../types'
import type { ResolvedStyleConfig } from './config'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../../logger'
import {
  changeFileExtension,
  normalizeRoot,
  toPosixPath,
} from '../../utils'
import {
  coerceStyleConfig,

  SUPPORTED_SHARED_STYLE_EXTENSIONS,
  SUPPORTED_SHARED_STYLE_EXTS,
} from './config'
import { addStyleEntry, appendDefaultScopedStyleEntries } from './entries'
import {
  getRelativePathWithinSubPackage,
  inferScopeFromRelativePath,
  resolveStyleEntryAbsolutePath,
} from './resolve'

export function normalizeSubPackageStyleEntries(
  styles: SubPackageStyleConfigEntry | SubPackageStyleConfigEntry[] | undefined,
  subPackage: SubPackage,
  configService: MutableCompilerContext['configService'],
): SubPackageStyleEntry[] | undefined {
  const service = configService
  if (!service) {
    return undefined
  }

  const root = subPackage.root?.trim()
  if (!root) {
    return undefined
  }

  const list = styles === undefined
    ? []
    : Array.isArray(styles) ? styles : [styles]

  const normalizedRoot = normalizeRoot(root)
  const normalized: SubPackageStyleEntry[] = []
  const dedupe = new Set<string>()
  for (const entry of list) {
    const descriptor = coerceStyleConfig(entry)
    if (!descriptor) {
      logger.warn(`[subpackages] 分包 ${root} 样式入口配置无效，已忽略。`)
      continue
    }

    const absolutePath = resolveStyleEntryAbsolutePath(descriptor.source, root, service)
    if (!absolutePath) {
      logger.warn(`[subpackages] 分包 ${root} 样式入口 \`${descriptor.source}\` 解析失败，已忽略。`)
      continue
    }

    if (!fs.existsSync(absolutePath)) {
      logger.warn(`[subpackages] 分包 ${root} 样式入口 \`${descriptor.source}\` 对应文件不存在，已忽略。`)
      continue
    }

    const ext = path.extname(absolutePath).toLowerCase()
    if (!SUPPORTED_SHARED_STYLE_EXTS.has(ext)) {
      logger.warn(`[subpackages] 分包 ${root} 样式入口 \`${descriptor.source}\` 当前仅支持以下格式：${SUPPORTED_SHARED_STYLE_EXTENSIONS.join(', ')}，已忽略。`)
      continue
    }

    const outputAbsolutePath = changeFileExtension(absolutePath, service.outputExtensions.wxss)
    const outputRelativePath = service.relativeOutputPath(outputAbsolutePath)
    if (!outputRelativePath) {
      logger.warn(`[subpackages] 分包 ${root} 样式入口 \`${descriptor.source}\` 不在项目源码目录内，已忽略。`)
      continue
    }

    const posixOutput = toPosixPath(outputRelativePath)
    const relativeWithinRoot = getRelativePathWithinSubPackage(posixOutput, normalizedRoot)
    const inferredScope = descriptor.explicitScope
      ? undefined
      : inferScopeFromRelativePath(relativeWithinRoot)

    const resolvedDescriptor: ResolvedStyleConfig = {
      ...descriptor,
      scope: inferredScope ?? descriptor.scope,
    }

    addStyleEntry(resolvedDescriptor, absolutePath, posixOutput, root, normalizedRoot, dedupe, normalized)
  }

  appendDefaultScopedStyleEntries(root, normalizedRoot, service, dedupe, normalized)

  return normalized.length ? normalized : undefined
}
