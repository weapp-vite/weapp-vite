import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import type { JsonEmitFileEntry } from '../jsonEmit'
import path from 'pathe'
import { supportedCssLangs } from '../../../../constants'
import { changeFileExtension, findJsonEntry, findTemplateEntry } from '../../../../utils'
import { pathExists as pathExistsCached } from '../../../utils/cache'
import { addNormalizedWatchFile } from '../../../utils/watchFiles'

export async function addWatchTarget(
  pluginCtx: PluginContext,
  target: string,
  existsCache: Map<string, boolean>,
  ttlMs: number,
): Promise<boolean> {
  if (!target) {
    return false
  }

  if (existsCache.has(target)) {
    const cached = existsCache.get(target)!
    addNormalizedWatchFile(pluginCtx, target)
    return cached
  }

  const exists = await pathExistsCached(target, { ttlMs })
  addNormalizedWatchFile(pluginCtx, target)

  existsCache.set(target, exists)
  return exists
}

export async function addPredictedWatchTargets(
  pluginCtx: PluginContext,
  predictions: string[],
  existsCache: Map<string, boolean>,
  ttlMs: number,
  knownExistingPath?: string,
) {
  await Promise.all(Array.from(new Set(predictions)).map(async (prediction) => {
    if (prediction && prediction === knownExistingPath) {
      existsCache.set(prediction, true)
      addNormalizedWatchFile(pluginCtx, prediction)
      return
    }
    await addWatchTarget(pluginCtx, prediction, existsCache, ttlMs)
  }))
}

export async function collectStyleImports(
  pluginCtx: PluginContext,
  id: string,
  existsCache: Map<string, boolean>,
  ttlMs: number,
) {
  const styleEntries = await Promise.all(supportedCssLangs.map(async (ext) => {
    const mayBeCssPath = changeFileExtension(id, ext)
    const exists = await addWatchTarget(pluginCtx, mayBeCssPath, existsCache, ttlMs)
    return exists ? mayBeCssPath : undefined
  }))
  return styleEntries.filter((entry): entry is string => Boolean(entry))
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
    await addPredictedWatchTargets(pluginCtx, predictions, existsCache, ttlMs, jsonPath)

    if (!jsonPath) {
      return
    }

    const content = await jsonService.read(jsonPath)
    registerJsonAsset({
      json: content,
      jsonPath,
      type: 'page',
    })
  }

  await processSideJson(sitemapLocation)
  await processSideJson(themeLocation)
}

export async function collectMiniappConfigFile(
  pluginCtx: PluginContext,
  id: string,
  configService: CompilerContext['configService'],
  jsonService: CompilerContext['jsonService'],
  registerJsonAsset: (entry: JsonEmitFileEntry) => void,
  existsCache: Map<string, boolean>,
  ttlMs: number,
) {
  if (configService.platform !== 'weapp') {
    return
  }

  const runtimeMiniappConfigPath = path.resolve(path.dirname(id), 'app.miniapp.json')
  const runtimeConfigExists = await addWatchTarget(pluginCtx, runtimeMiniappConfigPath, existsCache, ttlMs)
  if (runtimeConfigExists) {
    const content = await jsonService.read(runtimeMiniappConfigPath)
    registerJsonAsset({
      fileName: 'app.miniapp.json',
      json: content,
      jsonPath: runtimeMiniappConfigPath,
      type: 'page',
    })
    return
  }

  const miniappConfigPath = path.resolve(configService.cwd, 'project.miniapp.json')
  const exists = await addWatchTarget(pluginCtx, miniappConfigPath, existsCache, ttlMs)
  if (!exists) {
    return
  }

  const content = await jsonService.read(miniappConfigPath)
  registerJsonAsset({
    fileName: 'app.miniapp.json',
    json: content,
    jsonPath: miniappConfigPath,
    type: 'page',
  })
}

export async function ensureTemplateScanned(
  pluginCtx: PluginContext,
  id: string,
  scanTemplateEntry: (templateEntry: string) => Promise<void>,
  existsCache: Map<string, boolean>,
  ttlMs: number,
) {
  const { path: templateEntry, predictions } = await findTemplateEntry(id)
  await addPredictedWatchTargets(pluginCtx, predictions, existsCache, ttlMs, templateEntry)

  if (!templateEntry) {
    return ''
  }

  await scanTemplateEntry(templateEntry)

  return templateEntry
}
