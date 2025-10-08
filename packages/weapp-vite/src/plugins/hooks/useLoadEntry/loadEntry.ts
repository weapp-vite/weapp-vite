import type { PluginContext, ResolvedId } from 'rolldown'
import type { CompilerContext } from '../../../context'
import type { Entry } from '../../../types'
import type { JsonEmitFileEntry } from './jsonEmit'
import { performance } from 'node:perf_hooks'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { supportedCssLangs } from '../../../constants'
import logger from '../../../logger'
import { changeFileExtension, findJsonEntry, findTemplateEntry } from '../../../utils'
import { analyzeAppJson, analyzeCommonJson } from '../../utils/analyze'

interface EntryLoaderOptions {
  ctx: CompilerContext
  entriesMap: Map<string, Entry | undefined>
  loadedEntrySet: Set<string>
  normalizeEntry: (entry: string, jsonPath: string) => string
  registerJsonAsset: (entry: JsonEmitFileEntry) => void
  scanTemplateEntry: (templateEntry: string) => Promise<void>
  emitEntriesChunks: (this: PluginContext, resolvedIds: (ResolvedId | null)[]) => Promise<unknown>[]
  applyAutoImports: (baseName: string, json: any) => void
  debug?: (...args: any[]) => void
}

export function createEntryLoader(options: EntryLoaderOptions) {
  const {
    ctx,
    entriesMap,
    loadedEntrySet,
    normalizeEntry,
    registerJsonAsset,
    scanTemplateEntry,
    emitEntriesChunks,
    applyAutoImports,
    debug,
  } = options

  const { jsonService, configService } = ctx

  return async function loadEntry(this: PluginContext, id: string, type: 'app' | 'page' | 'component') {
    const start = performance.now()
    const getTime = () => `${(performance.now() - start).toFixed(2)}ms`
    const relativeCwdId = configService.relativeCwd(id)

    this.addWatchFile(id)
    const baseName = removeExtensionDeep(id)

    const jsonEntry = await findJsonEntry(id)
    let jsonPath = jsonEntry.path

    for (const prediction of jsonEntry.predictions) {
      await addWatchTarget(this, prediction)
    }

    let json: any = {}
    if (jsonPath) {
      json = await jsonService.read(jsonPath)
    }
    else {
      jsonPath = changeFileExtension(id, '.json')
    }

    const entries: string[] = []
    let templatePath = ''

    if (type === 'app') {
      entries.push(...analyzeAppJson(json))
      await collectAppSideFiles(
        this,
        id,
        json,
        jsonService,
        registerJsonAsset,
      )
    }
    else {
      templatePath = await ensureTemplateScanned(this, id, scanTemplateEntry)
      applyAutoImports(baseName, json)
      entries.push(...analyzeCommonJson(json))
    }

    const normalizedEntries = entries.map(entry => normalizeEntry(entry, jsonPath))
    for (const normalizedEntry of normalizedEntries) {
      entriesMap.set(normalizedEntry, {
        type: json.component ? 'component' : 'page',
        templatePath,
        jsonPath,
        json,
        path: id,
      })
    }

    const resolvedIds = await resolveEntries.call(
      this,
      normalizedEntries,
      configService.absoluteSrcRoot,
    )

    debug?.(`resolvedIds ${relativeCwdId} 耗时 ${getTime()}`)

    await Promise.all(
      emitEntriesChunks.call(
        this,
        resolvedIds.filter(({ entry, resolvedId }) => {
          if (!resolvedId) {
            logger.warn(`没有找到 \`${entry}\` 的入口文件，请检查路径是否正确!`)
            return false
          }

          if (loadedEntrySet.has(resolvedId.id)) {
            return false
          }

          return true
        }).map(item => item.resolvedId),
      ),
    )

    debug?.(`emitEntriesChunks ${relativeCwdId} 耗时 ${getTime()}`)

    registerJsonAsset({
      jsonPath,
      json,
      type,
    })

    const code = await fs.readFile(id, 'utf8')
    const ms = new MagicString(code)

    await prependStyleImports.call(this, id, ms)

    debug?.(`loadEntry ${relativeCwdId} 耗时 ${getTime()}`)

    return {
      code: ms.toString(),
    }
  }
}

async function collectAppSideFiles(
  pluginCtx: PluginContext,
  id: string,
  json: any,
  jsonService: CompilerContext['jsonService'],
  registerJsonAsset: (entry: JsonEmitFileEntry) => void,
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
      await addWatchTarget(pluginCtx, prediction)
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

async function ensureTemplateScanned(
  pluginCtx: PluginContext,
  id: string,
  scanTemplateEntry: (templateEntry: string) => Promise<void>,
) {
  const { path: templateEntry, predictions } = await findTemplateEntry(id)
  for (const prediction of predictions) {
    await addWatchTarget(pluginCtx, prediction)
  }

  if (!templateEntry) {
    return ''
  }

  await scanTemplateEntry(templateEntry)

  return templateEntry
}

async function resolveEntries(
  this: PluginContext,
  entries: string[],
  absoluteSrcRoot: string,
) {
  return Promise.all(
    entries
      .filter(entry => !entry.includes(':'))
      .map(async (entry) => {
        const absPath = path.resolve(absoluteSrcRoot, entry)
        return {
          entry,
          resolvedId: await this.resolve(absPath),
        }
      }),
  )
}

async function prependStyleImports(this: PluginContext, id: string, ms: MagicString) {
  for (const ext of supportedCssLangs) {
    const mayBeCssPath = changeFileExtension(id, ext)
    const exists = await addWatchTarget(this, mayBeCssPath)
    if (exists) {
      ms.prepend(`import '${mayBeCssPath}';\n`)
    }
  }
}

async function addWatchTarget(pluginCtx: PluginContext, target: string): Promise<boolean> {
  if (!target || typeof pluginCtx.addWatchFile !== 'function') {
    return false
  }

  const exists = await fs.exists(target)
  if (exists) {
    pluginCtx.addWatchFile(target)
  }

  return exists
}
