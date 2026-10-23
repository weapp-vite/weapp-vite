import type { CompilerContext } from '../../../context'
import type { ChangeEvent } from '../../../types'
import path from 'pathe'
import logger from '../../../logger'
import { getSelectedAutoRouteSource } from '../../../runtime/autoRoutesPlugin/selection'
import { ownsSidecarDelivery } from '../../../runtime/watch/sidecarDelivery'
import { findJsEntry, findVueEntry, touch } from '../../../utils/file'
import { invalidateFileCache } from '../cache'
import { collectAffectedScriptsAndImporters } from './cssGraph'
import { configSuffixes, normalizePath, watchedCssExts, watchedScriptModuleSuffixes, watchedTemplateExts } from './shared'

export async function invalidateEntryForSidecar(ctx: CompilerContext, filePath: string, event: ChangeEvent = 'update', options?: { isActive: () => boolean }) {
  const configSuffix = configSuffixes.find(suffix => filePath.endsWith(suffix))
  const ext = path.extname(filePath)
  const normalizedPath = normalizePath(filePath)
  const ownedDelivery = ownsSidecarDelivery(ctx, normalizedPath, event)

  let scriptBasePath: string | undefined

  if (configSuffix) {
    scriptBasePath = filePath.slice(0, -configSuffix.length)
  }
  else if (ext && watchedCssExts.has(ext)) {
    scriptBasePath = filePath.slice(0, -ext.length)
  }
  else if (ext && watchedTemplateExts.has(ext)) {
    scriptBasePath = filePath.slice(0, -ext.length)
  }

  const isScriptModuleSidecar = watchedScriptModuleSuffixes.some(suffix => normalizedPath.endsWith(suffix))

  if (!scriptBasePath && !isScriptModuleSidecar) {
    return
  }

  const isCssSidecar = Boolean(ext && watchedCssExts.has(ext))
  const isTemplateSidecar = Boolean(ext && watchedTemplateExts.has(ext))
  if (isCssSidecar) {
    // watcher 只失效读取缓存；可选样式归属统一由入口本轮扫描结果替换。
    invalidateFileCache(normalizedPath)
    ctx.runtimeState?.css?.transformedSidecarSource.delete(normalizedPath)
  }

  const touchedTargets = new Set<string>()
  const touchedScripts = new Set<string>()

  if (isScriptModuleSidecar || (ext && watchedTemplateExts.has(ext))) {
    const importers = ctx.wxmlService?.getImporters(normalizedPath) ?? new Set<string>()
    for (const importer of importers) {
      touchedTargets.add(importer)
    }
  }

  if (scriptBasePath) {
    const selected = getSelectedAutoRouteSource(ctx, scriptBasePath)
    const primaryScript = selected ? { path: selected } : await findJsEntry(scriptBasePath)
    const shouldSkipPrimaryTemplateTouch = event === 'update' && Boolean(ext && watchedTemplateExts.has(ext))

    if (primaryScript.path) {
      if (!shouldSkipPrimaryTemplateTouch) {
        touchedScripts.add(primaryScript.path)
      }
    }
    else if (ext && watchedTemplateExts.has(ext)) {
      const primaryVueEntry = await findVueEntry(scriptBasePath)
      if (primaryVueEntry && !shouldSkipPrimaryTemplateTouch) {
        touchedTargets.add(primaryVueEntry)
      }
    }

    if (!primaryScript.path && ext && watchedCssExts.has(ext)) {
      const { importers, scripts } = await collectAffectedScriptsAndImporters(ctx, normalizedPath)
      for (const importer of importers) {
        touchedTargets.add(importer)
      }
      for (const script of scripts) {
        touchedScripts.add(script)
      }
    }
  }

  const sidecarCause = configSuffix
    ? 'json-sidecar' as const
    : isCssSidecar
      ? 'style-sidecar' as const
      : 'sidecar-direct' as const
  const configService = ctx.configService
  const relativeSource = configService.relativeCwd(normalizedPath)
  const sidecarDirtyFiles = ctx.runtimeState?.watcher?.sidecarDirtyFiles

  for (const target of touchedTargets) {
    if (options?.isActive() === false || ownedDelivery || ownsSidecarDelivery(ctx, normalizedPath, event)) {
      return
    }
    sidecarDirtyFiles?.set(normalizePath(target), sidecarCause)
    try {
      await touch(target)
    }
    catch {}
  }

  for (const script of touchedScripts) {
    if (options?.isActive() === false || ownedDelivery || ownsSidecarDelivery(ctx, normalizedPath, event)) {
      return
    }
    sidecarDirtyFiles?.set(normalizePath(script), sidecarCause)
    try {
      await touch(script)
    }
    catch {}
  }

  if (!touchedTargets.size && !touchedScripts.size) {
    if (event === 'create' && (isCssSidecar || isTemplateSidecar || isScriptModuleSidecar)) {
      logger.info(`[sidecar:${event}] ${relativeSource} 新增，但未找到引用方，等待后续关联`)
    }
    return
  }

  const touchedList: string[] = []
  for (const target of touchedTargets) {
    touchedList.push(configService.relativeCwd(target))
  }
  for (const script of touchedScripts) {
    touchedList.push(configService.relativeCwd(script))
  }

  const uniqueTouched = Array.from(new Set(touchedList))

  logger.success(`[sidecar:${event}] ${relativeSource} -> 刷新 ${uniqueTouched.join(', ')}`)
}
