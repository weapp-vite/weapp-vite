import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import type { JsonEmitFileEntry } from '../jsonEmit'
import path from 'pathe'
import { supportedCssLangs } from '../../../../constants'
import { changeFileExtension, findJsonEntry, findTemplateEntry } from '../../../../utils'
import { normalizeWatchPath } from '../../../../utils/path'
import { pathExists as pathExistsCached } from '../../../utils/cache'

export async function addWatchTarget(
  pluginCtx: PluginContext,
  target: string,
  existsCache: Map<string, boolean>,
  ttlMs: number,
): Promise<boolean> {
  if (!target || typeof pluginCtx.addWatchFile !== 'function') {
    return false
  }

  if (existsCache.has(target)) {
    const cached = existsCache.get(target)!
    pluginCtx.addWatchFile(normalizeWatchPath(target))
    return cached
  }

  const exists = await pathExistsCached(target, { ttlMs })
  pluginCtx.addWatchFile(normalizeWatchPath(target))

  existsCache.set(target, exists)
  return exists
}

export async function collectStyleImports(
  pluginCtx: PluginContext,
  id: string,
  existsCache: Map<string, boolean>,
  ttlMs: number,
) {
  const styleImports: string[] = []
  for (const ext of supportedCssLangs) {
    const mayBeCssPath = changeFileExtension(id, ext)
    const exists = await addWatchTarget(pluginCtx, mayBeCssPath, existsCache, ttlMs)
    if (exists) {
      styleImports.push(mayBeCssPath)
    }
  }
  return styleImports
}

export async function collectAppSideFiles(
  pluginCtx: PluginContext,
  id: string,
  json: any,
  jsonService: CompilerContext['jsonService'],
  registerJsonAsset: (entry: JsonEmitFileEntry) => void,
  existsCache: Map<string, boolean>,
  ttlMs: number,
) {
  const { sitemapLocation = 'sitemap.json', themeLocation = 'theme.json' } = json

  const processSideJson = async (location?: string) => {
    if (!location) {
      return
    }

    const { path: jsonPath, predictions } = await findJsonEntry(
      path.resolve(path.dirname(id), location),
    )
    for (const prediction of predictions) {
      await addWatchTarget(pluginCtx, prediction, existsCache, ttlMs)
    }

    if (!jsonPath) {
      return
    }

    const content = await jsonService.read(jsonPath)
    registerJsonAsset({
      json: content,
      jsonPath,
      type: 'app',
    })
  }

  await processSideJson(sitemapLocation)
  await processSideJson(themeLocation)
}

export async function ensureTemplateScanned(
  pluginCtx: PluginContext,
  id: string,
  scanTemplateEntry: (templateEntry: string) => Promise<void>,
  existsCache: Map<string, boolean>,
  ttlMs: number,
) {
  const { path: templateEntry, predictions } = await findTemplateEntry(id)
  for (const prediction of predictions) {
    await addWatchTarget(pluginCtx, prediction, existsCache, ttlMs)
  }

  if (!templateEntry) {
    return ''
  }

  await scanTemplateEntry(templateEntry)

  return templateEntry
}
