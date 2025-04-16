import type { CompilerContext } from '@/context'
import type { Entry, ResolvedAlias, SubPackageMetaValue } from '@/types'
import type { ChangeEvent, EmittedAsset, PluginContext, ResolvedId, RollupOutput, RollupWatcher } from 'rollup'
import type { Plugin } from 'vite'
import { supportedCssLangs } from '@/constants'
import logger from '@/logger'
import { getCssRealPath, parseRequest } from '@/plugins/utils/parse'
import { isCSSRequest } from '@/utils'
import { changeFileExtension, findJsonEntry, findTemplateEntry, isJsOrTs } from '@/utils/file'
import { jsonFileRemoveJsExtension, matches } from '@/utils/json'
import { handleWxml } from '@/wxml/handle'
import { get, isEmptyObject, isObject, removeExtensionDeep, set } from '@weapp-core/shared'
// import debounce from 'debounce'
import fs from 'fs-extra'
import MagicString from 'magic-string'
// import PQueue from 'p-queue'
import path from 'pathe'
import { build } from 'vite'
import { analyzeAppJson, analyzeCommonJson } from './utils/analyze'
import { collectRequireTokens } from './utils/ast'

interface JsonEmitFileEntry {
  jsonPath?: string
  json: any
  type: 'app' | 'page' | 'component'
}

// const debouncedLoggerSuccess = debounce((message: string) => {
//   return logger.success(message)
// }, 25)

export function addModulesHot(entriesSet: Set<string>, pluginContext: PluginContext) {
  for (const entry of entriesSet) {
    const moduleInfo = pluginContext.getModuleInfo(entry)

    if (moduleInfo) {
      const stack = [moduleInfo.id] // 用栈模拟递归
      const visitedModules = new Set<string>()

      while (stack.length > 0) {
        const id = stack.pop()

        if (id && !visitedModules.has(id)) {
          visitedModules.add(id)

          const info = pluginContext.getModuleInfo(id)

          if (info) {
            pluginContext.addWatchFile(info.id)
            // 将子依赖加入栈
            stack.push(...info.importedIds)
          }
        }
      }
    }
  }
}

// export function getAffectedModules(this: PluginContext, id: string) {
//   this.cache.
//   const affectedModules: string[] = []
//   for (const module of this.cache.modules) {
//     if (module.id === id) {
//       module.imports.forEach(dep => affectedModules.push(dep))
//     }
//   }
//   return affectedModules
// }

export function weappVite(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin[] {
  const { scanService, configService, jsonService, wxmlService, autoImportService, buildService, watcherService } = ctx
  // entry Map
  const entriesMap = new Map<string, Entry | undefined>()
  // 加载过的 entry
  const loadedEntrySet = new Set<string>()
  const jsonEmitFilesMap: Map<string, EmittedAsset & {
    entry: Required<JsonEmitFileEntry>
  }> = new Map()

  // const watchChangeQueue = new PQueue()

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
          },
        )
      }
    })
  }

  async function scanTemplateEntry(templateEntry: string) {
    const wxmlToken = await wxmlService.scan(templateEntry)
    if (wxmlToken) {
      const { components } = wxmlToken
      wxmlService.setWxmlComponentsMap(templateEntry, components)
    }
  }
  async function loadEntry(this: PluginContext, id: string, type: 'app' | 'page' | 'component') {
    this.addWatchFile(id)
    const baseName = removeExtensionDeep(id)
    // page 可以没有 json
    let { path: jsonPath, predictions } = await findJsonEntry(id)
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
        await scanTemplateEntry(templateEntry)
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
    return {
      code: ms.toString(),
    }
  }

  let pq: Promise<{
    meta: SubPackageMetaValue
    rollup: RollupOutput | RollupOutput[] | RollupWatcher
  }>[] = []//

  return [
    {
      name: 'weapp-vite:pre',
      enforce: 'pre',
      buildStart() {
        loadedEntrySet.clear()
      },
      // https://github.com/rollup/rollup/blob/1f2d579ccd4b39f223fed14ac7d031a6c848cd80/src/Graph.ts#L97
      async watchChange(id: string, change: { event: ChangeEvent }) {
        if (subPackageMeta) {
          logger.success(`[${change.event}] ${configService.relativeCwd(id)} --[独立分包 ${subPackageMeta.subPackage.root}]`)
        }
        else {
          logger.success(`[${change.event}] ${configService.relativeCwd(id)}`)
        }
      },

      async options(options) {
        let scanedInput: Record<string, string>
        if (subPackageMeta) {
          scanedInput = subPackageMeta.entries.reduce<Record<string, string>>((acc, cur) => {
            acc[cur] = path.resolve(configService.absoluteSrcRoot, cur)
            return acc
          }, {})
        }
        else {
          // scanService.resetEntries()
          const appEntry = await scanService.loadAppEntry()
          pq = scanService.loadIndependentSubPackage().map(async (x) => {
            return {
              meta: x,
              rollup: await build(
                configService.merge(x, {
                  build: {
                    write: false,
                    rollupOptions: {
                      output: {
                        chunkFileNames() {
                          return `${x.subPackage.root}/[name]-[hash].js`
                        },
                      },
                    },
                  },
                }),
              ),
            }
          })
          buildService.queue.start()
          scanedInput = {
            app: appEntry.path,
          }
        }
        options.input = scanedInput// defu(options.input, scanedInput)
      },
      resolveId(id) {
        configService.weappViteConfig?.debug?.resolveId?.(id, subPackageMeta)
        if (id.endsWith('.wxss')) {
          return id.replace(/\.wxss$/, '.css?wxss')
        }
      },
      // 触发时机
      // https://github.com/rollup/rollup/blob/328fa2d18285185a20bf9b6fde646c3c28f284ae/src/ModuleLoader.ts#L284
      // 假如返回的是 null, 这时候才会往下添加到 this.graph.watchFiles
      // https://github.com/rollup/rollup/blob/328fa2d18285185a20bf9b6fde646c3c28f284ae/src/utils/PluginDriver.ts#L153
      async load(id) {
        configService.weappViteConfig?.debug?.load?.(id, subPackageMeta)
        const relativeBasename = removeExtensionDeep(
          configService
            .relativeAbsoluteSrcRoot(id),
        )
        if (isCSSRequest(id)) {
          const parsed = parseRequest(id)
          const realPath = getCssRealPath(parsed)
          this.addWatchFile(realPath)
          if (await fs.exists(realPath)) {
            const css = await fs.readFile(realPath, 'utf8')
            return {
              code: css,
            }
          }
        }
        else if (loadedEntrySet.has(id) || subPackageMeta?.entries.includes(relativeBasename)) {
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
      transform: {
        order: 'post',
        async handler(code, id) {
          if (isJsOrTs(id)) {
            try {
              const ast = this.parse(code)

              const { requireModules } = collectRequireTokens(ast)

              for (const requireModule of requireModules) {
                //  TODO 加载的 chunk 没有导出
                const absPath = path.resolve(path.dirname(id), requireModule.value)
                const resolveId = await this.resolve(absPath, id)
                if (resolveId) {
                  resolveId.moduleSideEffects = 'no-treeshake'

                  await this.load(resolveId)
                  this.emitFile({
                    type: 'chunk',
                    id: resolveId.id,
                    fileName: configService.relativeAbsoluteSrcRoot(
                      changeFileExtension(resolveId.id, '.js'),
                    ),
                  })
                }
              }
              return {
                code,
                ast,
                map: null,
              }
            }
            catch (error) {
              logger.error(error)
            }
          }
        },
      },
      // shouldTransformCachedModule() {
      //   return true
      // },
      renderStart() {
        for (const jsonEmitFile of jsonEmitFilesMap.values()) {
          if (jsonEmitFile.entry.json
            && isObject(jsonEmitFile.entry.json)
            && !isEmptyObject(jsonEmitFile.entry.json)) {
            this.emitFile(
              {
                type: 'asset',
                fileName: jsonEmitFile.fileName,
                source: jsonService.resolve(jsonEmitFile.entry),
              },
            )
          }
        }

        const currentPackageWxmls = Array.from(
          wxmlService.tokenMap.entries(),
        )
          .map(([id, token]) => {
            return {
              id,
              token,
              fileName: configService.relativeAbsoluteSrcRoot(id),
            }
          })
          .filter(({ fileName }) => {
            if (subPackageMeta) {
              return fileName.startsWith(subPackageMeta.subPackage.root)
            }
            else {
              return scanService.isMainPackageFileName(fileName)
            }
          })

        for (const { fileName, token } of currentPackageWxmls) {
          const result = handleWxml(token)

          this.emitFile(
            {
              type: 'asset',
              fileName, // templateEmitFile.fileName,
              source: result.code,
            },
          )
        }
      },
      async generateBundle(_options, bundle) {
        if (!subPackageMeta) {
          const res = (await Promise.all(pq))

          const chunks = res.reduce<RollupOutput[]>((acc, { meta, rollup }) => {
            const chunk = Array.isArray(rollup) ? rollup[0] : rollup
            if ('output' in chunk) {
              acc.push(chunk)
              return acc
            }
            else {
              // 这里其实就返回的是RollupWatcher了
              watcherService.setRollupWatcher(chunk, meta.subPackage.root)
            }
            return acc
          }, [])
          for (const chunk of chunks) {
            for (const output of chunk.output) {
              bundle[output.fileName] = output
            }
          }
        }
        if (configService.weappViteConfig?.debug?.watchFiles) {
          const watchFiles = this.getWatchFiles()
          configService.weappViteConfig.debug.watchFiles(watchFiles, subPackageMeta)
        }
      },
      // closeBundle() {
      //   if (configService.weappViteConfig?.debug?.watchFiles) {
      //     const watchFiles = this.getWatchFiles()
      //     configService.weappViteConfig.debug.watchFiles(watchFiles, subPackageMeta)
      //   }
      // },
    },
  ]
}
