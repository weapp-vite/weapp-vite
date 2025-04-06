import type { CompilerContext } from '@/context'
import type { Entry, ResolvedAlias, SubPackageMetaValue } from '@/types'
import type { EmittedAsset, PluginContext } from 'rollup'
import type { Plugin } from 'vite'
import { supportedCssLangs } from '@/constants'
import { getCssRealPath, parseRequest } from '@/plugins/parse'
import { isCSSRequest } from '@/utils'
import { changeFileExtension, findJsonEntry, findTemplateEntry } from '@/utils/file'
import { jsonFileRemoveJsExtension, matches } from '@/utils/json'
import { handleWxml } from '@/wxml/handle'
import { isObject, removeExtensionDeep, set } from '@weapp-core/shared'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { analyzeAppJson, analyzeCommonJson } from './analyze'

interface JsonEmitFileEntry {
  jsonPath?: string
  json: any
  type: 'app' | 'page' | 'component'
}

export function weappViteNext(ctx: CompilerContext, _subPackageMeta?: SubPackageMetaValue): Plugin[] {
  const { scanService, configService, jsonService, wxmlService, autoImportService } = ctx
  const entriesMap = new Map<string, Entry | undefined>()
  const emitedChunkSet = new Set<string>()
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

  function setJsonEmitFilesMap(entry: JsonEmitFileEntry) {
    if (entry.jsonPath) {
      const fileName = configService.relativeAbsoluteSrcRoot(jsonFileRemoveJsExtension(entry.jsonPath))

      jsonEmitFilesMap.set(fileName, {
        type: 'asset',
        fileName,
        entry: entry as Required<JsonEmitFileEntry>,
      })
    }
  }
  // const templateEmitFilesMap: Map<string, EmittedAsset & { rawSource: any }> = new Map()
  function emitEntriesChunks(this: PluginContext, entries: string[]) {
    return entries.map(async (x) => {
      if (emitedChunkSet.has(x)) {
        return
      }
      const absPath = path.resolve(configService.absoluteSrcRoot, x)
      const resolvedId = await this.resolve(absPath)
      if (resolvedId) {
        emitedChunkSet.add(x)
        await this.load(resolvedId)

        const fileName = configService.relativeAbsoluteSrcRoot(changeFileExtension(resolvedId.id, '.js'))
        this.emitFile(
          {
            type: 'chunk',
            id: resolvedId.id,
            fileName,
          },
        )
      }
    })
  }

  async function loadEntry(this: PluginContext, id: string, type: 'app' | 'page' | 'component') {
    const baseName = removeExtensionDeep(id)
    // page 可以没有 json
    let jsonPath = await findJsonEntry(id)
    let json: any = {}
    if (jsonPath) {
      json = await jsonService.read(jsonPath)
    }
    else {
      jsonPath = changeFileExtension(id, '.json')
    }

    const entries: string[] = []
    if (type === 'app') {
      entries.push(...analyzeAppJson(json))

      const { sitemapLocation = 'sitemap.json', themeLocation = 'theme.json' } = json
      // sitemap.json
      if (sitemapLocation) {
        const sitemapJsonPath = await findJsonEntry(path.resolve(path.dirname(id), sitemapLocation))
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
        const themeJsonPath = await findJsonEntry(path.resolve(path.dirname(id), themeLocation))
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
      const templateEntry = await findTemplateEntry(id)
      if (templateEntry) {
        this.addWatchFile(templateEntry)
        const wxmlToken = await wxmlService.scan(templateEntry)
        if (wxmlToken) {
          const { components } = wxmlToken
          wxmlService.setWxmlComponentsMap(templateEntry, components)
        }
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
              if (isObject(json.usingComponents) && Reflect.has(json.usingComponents, value.name)) {
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
                if (!(isObject(json.usingComponents) && Reflect.has(json.usingComponents, value.name))) {
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

    const absEntries = entries.map(entry => normalizeEntry(entry, jsonPath))
    // set entriesMap
    for (const entry of absEntries) {
      entriesMap.set(entry, undefined)
    }

    await Promise.all(
      [
        ...emitEntriesChunks.call(this, absEntries.filter(entry => !entry.includes(':'))),
      ],
    )

    setJsonEmitFilesMap({
      jsonPath,
      json,
      type,
    })

    const code = await fs.readFile(id, 'utf8')
    const ms = new MagicString(code)
    for (const ext of supportedCssLangs) {
      const mayBeCssPath = changeFileExtension(id, ext)

      if (await fs.exists(mayBeCssPath)) {
        ms.prepend(`import '${mayBeCssPath}'\n`)
      }
    }
    return {
      code: ms.toString(),
    }
  }

  return [
    {
      name: 'weapp-vite:pre',
      enforce: 'pre',
      async options(options) {
        scanService.resetEntries()
        const appEntry = await scanService.loadAppEntry()

        options.input = {
          app: appEntry.path,
        }
      },
      resolveId(id) {
        if (id.endsWith('.wxss')) {
          return id.replace(/\.wxss$/, '.css?wxss')
        }
      },
      async load(id) {
        const relativeBasename = removeExtensionDeep(
          configService
            .relativeAbsoluteSrcRoot(id),
        )
        if (isCSSRequest(id)) {
          const parsed = parseRequest(id)
          const realPath = getCssRealPath(parsed)
          if (await fs.exists(realPath)) {
            const css = await fs.readFile(realPath, 'utf8')
            return {
              code: css,
            }
          }
        }
        else if (entriesMap.has(relativeBasename)) {
          return await loadEntry.call(this, id, 'component')
        }
        else if ([
          'app',
        ].includes(
          relativeBasename,
        )) {
          // isApp
          return await loadEntry.call(this, id, 'app')
        }
      },
      buildEnd() {

      },
      generateBundle(_opts, _bundle) {
        for (const jsonEmitFile of jsonEmitFilesMap.values()) {
          this.emitFile(
            {
              type: 'asset',
              fileName: jsonEmitFile.fileName,
              source: jsonService.resolve(jsonEmitFile.entry),
            },
          )
        }
        for (const [id, token] of wxmlService.tokenMap.entries()) {
          this.emitFile(
            {
              type: 'asset',
              fileName: configService.relativeAbsoluteSrcRoot(id), // templateEmitFile.fileName,
              source: handleWxml(token).code,
            },
          )
        }
      },
    },
  ]
}
