import type { MutableCompilerContext } from '../../../context'
import type {
  StyleConfigEntry,
  StyleEntry,
  SubPackage,
} from '../../../types'
import type { ResolvedStyleConfig } from './config'
import fs from 'node:fs'
import path from 'pathe'
import logger from '../../../logger'
import {
  changeFileExtension,
  normalizeRoot,
  toPosixPath,
} from '../../../utils'
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

export function isSupportedSharedStyleExtension(absolutePath: string) {
  return SUPPORTED_SHARED_STYLE_EXTS.has(path.extname(absolutePath).toLowerCase())
}

export function resolveStyleEntryScope(
  descriptor: ResolvedStyleConfig,
  posixOutput: string,
  normalizedRoot: string,
) {
  if (descriptor.explicitScope) {
    return descriptor.scope
  }

  const relativeWithinRoot = getRelativePathWithinSubPackage(posixOutput, normalizedRoot)
  return inferScopeFromRelativePath(relativeWithinRoot) ?? descriptor.scope
}

function normalizeStyleEntries(
  styles: StyleConfigEntry | StyleConfigEntry[] | undefined,
  root: string,
  configService: MutableCompilerContext['configService'],
  options: {
    warningPrefix: string
    appendDefaultEntries: boolean
  },
): StyleEntry[] | undefined {
  const service = configService
  if (!service) {
    return undefined
  }

  const list = styles === undefined
    ? []
    : Array.isArray(styles) ? styles : [styles]

  const normalizedRoot = normalizeRoot(root)
  const normalized: StyleEntry[] = []
  const dedupe = new Set<string>()
  for (const entry of list) {
    const descriptor = coerceStyleConfig(entry)
    if (!descriptor) {
      logger.warn(`${options.warningPrefix}样式入口配置无效，已忽略。`)
      continue
    }

    const absolutePath = resolveStyleEntryAbsolutePath(descriptor.source, root, service)
    if (!absolutePath) {
      logger.warn(`${options.warningPrefix}样式入口 \`${descriptor.source}\` 解析失败，已忽略。`)
      continue
    }

    if (!fs.existsSync(absolutePath)) {
      logger.warn(`${options.warningPrefix}样式入口 \`${descriptor.source}\` 对应文件不存在，已忽略。`)
      continue
    }

    if (!isSupportedSharedStyleExtension(absolutePath)) {
      logger.warn(`${options.warningPrefix}样式入口 \`${descriptor.source}\` 当前仅支持以下格式：${SUPPORTED_SHARED_STYLE_EXTENSIONS.join(', ')}，已忽略。`)
      continue
    }

    const outputAbsolutePath = changeFileExtension(absolutePath, service.outputExtensions.wxss)
    const outputRelativePath = service.relativeOutputPath(outputAbsolutePath)
    if (!outputRelativePath) {
      logger.warn(`${options.warningPrefix}样式入口 \`${descriptor.source}\` 不在项目源码目录内，已忽略。`)
      continue
    }

    const posixOutput = toPosixPath(outputRelativePath)
    const resolvedDescriptor: ResolvedStyleConfig = {
      ...descriptor,
      scope: resolveStyleEntryScope(descriptor, posixOutput, normalizedRoot),
    }

    addStyleEntry(resolvedDescriptor, absolutePath, posixOutput, normalizedRoot, options.warningPrefix, dedupe, normalized)
  }

  if (options.appendDefaultEntries) {
    appendDefaultScopedStyleEntries(root, normalizedRoot, service, dedupe, normalized)
  }

  return normalized.length ? normalized : undefined
}

export function normalizeSubPackageStyleEntries(
  styles: StyleConfigEntry | StyleConfigEntry[] | undefined,
  subPackage: SubPackage,
  configService: MutableCompilerContext['configService'],
): StyleEntry[] | undefined {
  const root = subPackage.root?.trim()
  if (!root) {
    return undefined
  }

  return normalizeStyleEntries(styles, root, configService, {
    warningPrefix: `[分包] 分包 ${root} `,
    appendDefaultEntries: true,
  })
}

export function normalizeMainPackageStyleEntries(
  styles: StyleConfigEntry | StyleConfigEntry[] | undefined,
  configService: MutableCompilerContext['configService'],
): StyleEntry[] | undefined {
  if (styles === undefined) {
    return undefined
  }

  return normalizeStyleEntries(styles, '', configService, {
    warningPrefix: '[样式] 主包 ',
    appendDefaultEntries: false,
  })
}
