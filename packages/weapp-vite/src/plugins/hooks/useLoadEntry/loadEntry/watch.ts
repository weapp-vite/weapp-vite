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
  for (const prediction of predictions) {
    await addWatchTarget(pluginCtx, prediction, existsCache, ttlMs)
  }

  if (!templateEntry) {
    return ''
  }

  await scanTemplateEntry(templateEntry)

  return templateEntry
}
