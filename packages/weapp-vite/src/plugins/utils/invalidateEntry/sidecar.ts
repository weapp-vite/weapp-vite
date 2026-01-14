import type { CompilerContext } from '../../../context'
import type { ChangeEvent } from '../../../types'
import path from 'pathe'
import logger from '../../../logger'
import { findJsEntry, touch } from '../../../utils/file'
import { collectAffectedScriptsAndImporters } from './cssGraph'
import { configSuffixes, normalizePath, watchedCssExts, watchedTemplateExts } from './shared'

export async function invalidateEntryForSidecar(ctx: CompilerContext, filePath: string, event: ChangeEvent = 'update') {
  const configSuffix = configSuffixes.find(suffix => filePath.endsWith(suffix))
  const ext = path.extname(filePath)
  const normalizedPath = normalizePath(filePath)

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

  if (!scriptBasePath) {
    return
  }

  const touchedTargets = new Set<string>()
  const touchedScripts = new Set<string>()

  const primaryScript = await findJsEntry(scriptBasePath)
  if (primaryScript.path) {
    touchedScripts.add(primaryScript.path)
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

  const isCssSidecar = Boolean(ext && watchedCssExts.has(ext))
  const isTemplateSidecar = Boolean(ext && watchedTemplateExts.has(ext))
  const configService = ctx.configService
  const relativeSource = configService.relativeCwd(normalizedPath)

  for (const target of touchedTargets) {
    try {
      await touch(target)
    }
    catch {}
  }

  for (const script of touchedScripts) {
    try {
      await touch(script)
    }
    catch {}
  }

  if (!touchedTargets.size && !touchedScripts.size) {
    if (event === 'create' && (isCssSidecar || isTemplateSidecar)) {
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
