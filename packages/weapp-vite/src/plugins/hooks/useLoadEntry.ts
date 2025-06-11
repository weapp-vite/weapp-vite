import type { EmittedAsset, PluginContext, ResolvedId } from 'rolldown'
import type { CompilerContext } from '@/context'
import type { Entry, ResolvedAlias } from '@/types'
import { performance } from 'node:perf_hooks'
import { get, isObject, removeExtensionDeep, set } from '@weapp-core/shared'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { supportedCssLangs } from '@/constants'
import { createDebugger } from '@/debugger'
import logger from '@/logger'
import { changeFileExtension, findJsonEntry, findTemplateEntry, jsonFileRemoveJsExtension, matches } from '@/utils'
import { analyzeAppJson, analyzeCommonJson } from '../utils/analyze'

const debug = createDebugger('weapp-vite:load-entry')
export interface JsonEmitFileEntry {
  jsonPath?: string
  json: any
  type: 'app' | 'page' | 'component'
}

export function useLoadEntry({ jsonService, wxmlService, configService, autoImportService }: CompilerContext) {
  const entriesMap = new Map<string, Entry | undefined>()
  // 加载过的 entry
  const loadedEntrySet = new Set<string>()
  const jsonEmitFilesMap: Map<string, EmittedAsset & {
    entry: Required<JsonEmitFileEntry>
  }> = new Map()

  function resolveImportee(importee: string, jsonPath: string, aliasEntries?: ResolvedAlias[]) {
    let updatedId = importee
    if (Array.isArray(aliasEntries)) {
      if (!jsonPath) {
        return importee
      }
      const matchedEntry = aliasEntries.find(x => matches(x.find, importee))
      if (matchedEntry) {
        updatedId = importee.replace(matchedEntry.find, matchedEntry.replacement)
      }
    }
    return configService.relativeAbsoluteSrcRoot(
      path.resolve(path.dirname(jsonPath), updatedId),
    )
  }

  function setJsonEmitFilesMap(entry: JsonEmitFileEntry) {
    if (entry.jsonPath) {
      const fileName = configService.relativeAbsoluteSrcRoot(jsonFileRemoveJsExtension(entry.jsonPath))

      jsonEmitFilesMap.set(
        fileName,
        // @ts-ignore
        {
          type: 'asset',
          fileName,
          entry: entry as Required<JsonEmitFileEntry>,
        },
      )
    }
  }

  async function scanTemplateEntry(templateEntry: string) {
    const start = performance.now()

    const wxmlToken = await wxmlService.scan(templateEntry)
    if (wxmlToken) {
      const { components } = wxmlToken
      wxmlService.setWxmlComponentsMap(templateEntry, components)
    }
    debug?.(`扫描模板 ${templateEntry} 耗时 ${(performance.now() - start).toFixed(2)}ms`)
  }

  function normalizeEntry(entry: string, from: string) {
    // 微信插件
    if (/plugin:\/\//.test(entry)) {
      // console.log(`发现插件 ${usingComponent}`)
      return entry
    }
    const tokens = entry.split('/')
    // 来自 dependencies 的依赖直接跳过
    if (
      tokens[0]
      && isObject(configService.packageJson.dependencies)
      && Object.keys(configService.packageJson.dependencies)
        .find(
          (dep) => {
            const depTokens = dep.split('/')
            for (let i = 0; i < Math.min(tokens.length, depTokens.length); i++) {
              if (tokens[i] === depTokens[i]) {
                continue
              }
              return false
            }

            return true
          },
        )) {
      return `npm:${entry}`
    }
    // start with '/' 表述默认全局别名
    else if (tokens[0] === '') {
      return entry.substring(1)
    }
    else {
      // 处理别名
      const importee = resolveImportee(entry, from, configService.aliasEntries)
      return importee
    }
  }

  function emitEntriesChunks(this: PluginContext, resolvedIds: (ResolvedId | null)[]) {
    return resolvedIds.map(async (resolvedId) => {
      if (resolvedId) {
        loadedEntrySet.add(resolvedId.id)
        await this.load(resolvedId)

        const fileName = configService.relativeAbsoluteSrcRoot(changeFileExtension(resolvedId.id, '.js'))
        this.emitFile(
          {
            type: 'chunk',
            id: resolvedId.id,
            fileName,
            // 是否需要导出？我的理解是不需要，因为所有的 entry 都会带有构造方法作为模块的副作用
            // 但是 plugin export 是需要的
            // @ts-ignore
            preserveSignature: 'exports-only',
          },
        )
      }
    })
    // debug?.(`emitEntriesChunks 耗时 ${getTime()}`)
    // return result
  }

  async function loadEntry(this: PluginContext, id: string, type: 'app' | 'page' | 'component') {
    const start = performance.now()
    const getTime = () => `${(performance.now() - start).toFixed(2)}ms`
    const relativeCwdId = configService.relativeCwd(id)

    this.addWatchFile(id)
    const baseName = removeExtensionDeep(id)
    // page 可以没有 json
    const jsonEntry = await findJsonEntry(id)
    let jsonPath = jsonEntry.path
    const predictions = jsonEntry.predictions

    for (const prediction of predictions) {
      this.addWatchFile(prediction)
    }
    let json: any = {}
    if (jsonPath) {
      json = await jsonService.read(jsonPath)
    }
    else {
      jsonPath = changeFileExtension(id, '.json')
    }

    const entries: string[] = []
    let templatePath: string = ''
    if (type === 'app') {
      entries.push(...analyzeAppJson(json))

      const { sitemapLocation = 'sitemap.json', themeLocation = 'theme.json' } = json
      // sitemap.json
      if (sitemapLocation) {
        const { path: sitemapJsonPath, predictions } = await findJsonEntry(path.resolve(path.dirname(id), sitemapLocation))
        for (const prediction of predictions) {
          this.addWatchFile(prediction)
        }
        if (sitemapJsonPath) {
          const sitemapJson = await jsonService.read(sitemapJsonPath)
          setJsonEmitFilesMap({
            json: sitemapJson,
            jsonPath: sitemapJsonPath,
            type: 'app',
          })
        }
      }
      // theme.json
      if (themeLocation) {
        const { path: themeJsonPath, predictions } = await findJsonEntry(path.resolve(path.dirname(id), themeLocation))
        for (const prediction of predictions) {
          this.addWatchFile(prediction)
        }
        if (themeJsonPath) {
          const themeJson = await jsonService.read(themeJsonPath)
          setJsonEmitFilesMap({
            json: themeJson,
            jsonPath: themeJsonPath,
            type: 'app',
          })
        }
      }
    }
    else {
      const { path: templateEntry, predictions } = await findTemplateEntry(id)
      for (const prediction of predictions) {
        this.addWatchFile(prediction)
      }
      if (templateEntry) {
        templatePath = templateEntry
        // const t0 = performance.now()
        // 已经存在缓存了
        await scanTemplateEntry(templateEntry)
        // logger.info(`扫描模板 ${templateEntry} 耗时 ${(performance.now() - t0).toFixed(2)}ms`)
      }
      // 自动导入 start

      const hit = wxmlService.wxmlComponentsMap.get(baseName)

      if (hit) {
        const depComponentNames = Object.keys(hit)
        for (const depComponentName of depComponentNames) {
          // auto import globs
          const res = autoImportService.potentialComponentMap.get(depComponentName)
          if (res) {
            // componentEntry 为目标引入组件
            const { entry: componentEntry, value } = res
            if (componentEntry?.jsonPath) {
              const usingComponents = get(json, 'usingComponents')
              if (isObject(usingComponents) && Reflect.has(usingComponents, value.name)) {
                continue
              }
              set(json, `usingComponents.${value.name}`, value.from)
            }
          }
          // resolvers
          else if (Array.isArray(configService.weappViteConfig?.enhance?.autoImportComponents?.resolvers)) {
            for (const resolver of configService.weappViteConfig.enhance.autoImportComponents.resolvers) {
              const value = resolver(depComponentName, baseName)
              if (value) {
                // 重复
                const usingComponents = get(json, 'usingComponents')
                if (!(isObject(usingComponents) && Reflect.has(usingComponents, value.name))) {
                  set(json, `usingComponents.${value.name}`, value.from)
                }
              }
            }
          }
        }
      }
      // 自动导入 end

      entries.push(...analyzeCommonJson(json))
    }

    const normalizedEntries = entries.map(entry => normalizeEntry(entry, jsonPath))
    // 设置入口文件集合，不包含 app
    for (const normalizedEntry of normalizedEntries) {
      entriesMap.set(normalizedEntry, {
        type: json.component ? 'component' : 'page',
        templatePath,
        jsonPath,
        json,
        path: id,
      })
    }
    const resolvedIds = await Promise.all(
      normalizedEntries
        .filter(
          // 排除 plugin: 和 npm:
          entry => !entry.includes(':'),
        ).map(
          async (entry) => {
            const absPath = path.resolve(configService.absoluteSrcRoot, entry)
            return {
              entry,
              resolvedId: await this.resolve(absPath),
            }
          },
        ),
    )
    debug?.(`解析 ${relativeCwdId} resolvedIds 耗时 ${getTime()}`)
    await Promise.all(
      [
        ...emitEntriesChunks.call(
          this,
          resolvedIds.filter(({ entry, resolvedId }) => {
            if (resolvedId) {
              if (!loadedEntrySet.has(resolvedId.id)) {
                return true
              }
              else {
                return false
              }
            }
            else {
              logger.warn(`没有找到 \`${entry}\` 的入口文件，请检查路径是否正确!`)
              return false
            }
          }).map(x => x.resolvedId),
        ),
      ],
    )
    debug?.(`处理 ${relativeCwdId} emitEntriesChunks 耗时 ${getTime()}`)

    setJsonEmitFilesMap({
      jsonPath,
      json,
      type,
    })

    const code = await fs.readFile(id, 'utf8')
    const ms = new MagicString(code)
    for (const ext of supportedCssLangs) {
      const mayBeCssPath = changeFileExtension(id, ext)
      // 监控其他的文件是否产生
      this.addWatchFile(mayBeCssPath)
      if (await fs.exists(mayBeCssPath)) {
        ms.prepend(`import '${mayBeCssPath}';\n`)
      }
    }
    debug?.(`加载 ${relativeCwdId} 耗时 ${getTime()}`)
    return {
      code: ms.toString(),
    }
  }

  return {
    loadEntry,
    entriesMap,
    loadedEntrySet,
    jsonEmitFilesMap,
  }
}
