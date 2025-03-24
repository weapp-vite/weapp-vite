import type { CompilerContext } from '@/context'
import type { Entry, SubPackageMetaValue, WeappVitePluginApi, WxmlDep } from '@/types'
import type { ChangeEvent, CustomPluginOptions, EmittedFile, InputOption, InputOptions, LoadResult, OutputBundle, PluginContext, ResolveIdResult } from 'rollup'
import type { Plugin, ResolvedConfig } from 'vite'
import { jsExtensions, supportedCssLangs } from '@/constants'
import { createDebugger } from '@/debugger'
import { defaultExcluded } from '@/defaults'
import logger from '@/logger'
import { cssPostProcess } from '@/postcss'
import { changeFileExtension, isCSSRequest, isJsOrTs, jsonFileRemoveJsExtension, resolveGlobs } from '@/utils'
import { handleWxml, scanWxml } from '@/wxml'
import { transformWxsCode } from '@/wxs'
import { isObject, removeExtension } from '@weapp-core/shared'
import debounce from 'debounce'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import { recursive } from 'merge'
import path from 'pathe'
import { getCssRealPath, parseRequest } from './parse'

const debug = createDebugger('weapp-vite:plugin')

// const rr = /require\(['"]([^'"]+)['"]\)/
// const rra = /require\s*\.async\(['"]([^'"]+)['"]\)/
// const rrcb = /require\(['"]([^'"]+)['"],\s*\(mod\s*=>\s*\{[\s\S]*?\},\s*\(\{[\s\S]*?\}\)\s*=>\s*\{[\s\S]*?\}\)\)/

export interface IFileMeta {
  relPath: string
  absPath: string
  fileName: string
}

const debouncedLoggerSuccess = debounce((message: string) => {
  return logger.success(message)
}, 25)

function isTemplateRequest(request: string) {
  return request.endsWith('.wxml') || request.endsWith('.html')
}

/**
 * 生命周期跟着 vite build 走的插件
 * 所以在构建主体 和 独立分包的时候，会多次触发
 */
export class VitePluginService {
  resolvedConfig!: ResolvedConfig
  entriesSet: Set<string>
  entries: Entry[]
  cachedEmittedFiles: EmittedFile[]
  cachedWatchFiles: string[]
  cachedWorkerFiles: IFileMeta[]

  constructor(public ctx: CompilerContext) {
    this.entriesSet = new Set()
    this.entries = []
    this.cachedEmittedFiles = []
    this.cachedWatchFiles = []
    this.cachedWorkerFiles = []
  }

  configResolved(config: ResolvedConfig) {
    const idx = config.plugins?.findIndex(x => x.name === 'vite:build-import-analysis')
    if (idx > -1) {
      (config.plugins as Plugin<WeappVitePluginApi>[]).splice(idx, 1)
    }
    this.resolvedConfig = config
    if (isObject(this.resolvedConfig.env)) {
      for (const [key, value] of Object.entries(this.resolvedConfig.env)) {
        this.ctx.configService.setDefineEnv(key, value)
      }
    }
  }

  getInputOption(entries: string[]) {
    return entries
      .reduce<Record<string, string>>((acc, cur) => {
        acc[this.ctx.configService.relativeCwd(cur)] = cur
        return acc
      }, {})
  }

  getUserDefinedInput(input?: InputOption) {
    return typeof input === 'string'
      ? input.endsWith('.html')
        ? {}
        : {
            [
            this.ctx.configService.relativeCwd(input)
            ]: input,
          }
      : Array.isArray(input)
        ? input.reduce<Record<string, string>>((acc, cur) => {
            acc[
              this.ctx.configService.relativeCwd(cur)
            ] = cur
            return acc
          }, {})
        : input
  }

  mergeInputOption(entries: string[], input?: InputOption) {
    const userDefinedInput = this.getUserDefinedInput(input)

    return recursive(
      this.getInputOption(entries),
      userDefinedInput,
    )
  }

  async handleWxsDeps(deps: WxmlDep[], absPath: string) {
    for (const wxsDep of deps.filter(x => x.tagName === 'wxs')) {
      // only ts and js
      if (jsExtensions.includes(wxsDep.attrs.lang) || /\.wxs\.[jt]s$/.test(wxsDep.value)) {
        const wxsPath = path.resolve(path.dirname(absPath), wxsDep.value)
        if (await fs.exists(wxsPath)) {
          this.cachedWatchFiles.push(wxsPath)
          const code = await fs.readFile(wxsPath, 'utf8')
          const res = transformWxsCode(code, {
            filename: wxsPath,
          })
          if (res?.code) {
            this.cachedEmittedFiles.push(
              {
                type: 'asset',
                fileName: this.ctx.configService.relativeSrcRoot(this.ctx.configService.relativeCwd(removeExtension(wxsPath))),
                source: res.code,
              },
            )
          }
        }
      }
    }
  }

  addModulesHot(pluginContext: PluginContext) {
    for (const entry of this.entriesSet) {
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

  resetCache() {
    // clear cache
    this.cachedEmittedFiles.length = 0
    this.cachedWatchFiles.length = 0
    this.cachedWorkerFiles.length = 0
    this.ctx.scanService.resetAutoImport()
  }

  async options(options: InputOptions, subPackageMeta?: SubPackageMetaValue) {
    // 主包
    if (!subPackageMeta) {
      await this.ctx.scanService.loadAppEntry()
    }

    // clear cache
    this.resetCache()

    const { build, weapp } = this.resolvedConfig

    const ignore: string[] = [
      ...defaultExcluded,
      `${build.outDir}/**`,
    ]

    // app 忽略独立分包
    if (!subPackageMeta) {
      for (const subPackageRoot of Object.keys(this.ctx.subPackageService.metaMap)) {
        ignore.push(path.join(subPackageRoot, '**'))
      }
    }

    ignore.push(...resolveGlobs(weapp?.copy?.exclude))
    // 独立分包只 copy 分包部分，否则是主包和普通分包
    const targetDir = subPackageMeta ? path.join(this.ctx.configService.srcRoot, subPackageMeta.subPackage.root) : this.ctx.configService.srcRoot

    const assetGlobs = [
      '**/*.{wxml,html,wxs}',
      '**/*.{png,jpg,jpeg,gif,svg,webp}',
    ]
    if (this.ctx.scanService.workersDir) {
      assetGlobs.push(path.join(this.ctx.scanService.workersDir, '**/*.{js,ts}'))
    }

    assetGlobs.push(...resolveGlobs(weapp?.copy?.include))

    const patterns = assetGlobs.map(
      (x) => {
        return path.join(
          targetDir,
          x,
        )
      },
    )
    // 把 wxml,wxs 这些资源放入是为了让 vite plugin 去处理，否则单纯的 copy 没法做转化
    const relFiles = await new Fdir()
      .withRelativePaths()
      .globWithOptions(
        patterns,
        {
          cwd: this.ctx.configService.cwd,
          ignore,
          windows: true,
          posixSlashes: true,
        },
      )
      .crawl(this.ctx.configService.cwd)
      .withPromise()

    const wxmlFiles: IFileMeta[] = []
    const wxsFiles: IFileMeta[] = []
    const mediaFiles: IFileMeta[] = []

    for (const relPath of relFiles) {
      const absPath = path.resolve(this.ctx.configService.cwd, relPath)
      this.cachedWatchFiles.push(absPath)
      const isWxs = relPath.endsWith('.wxs')
      const isWorker = isJsOrTs(relPath) && this.ctx.scanService.workersDir && this.ctx.configService.relativeSrcRoot(relPath).startsWith(this.ctx.scanService.workersDir)
      const fileName = this.ctx.configService.relativeSrcRoot(relPath)
      if (isTemplateRequest(relPath)) {
        if (weapp?.enhance?.autoImportComponents && this.ctx.autoImportService.filter(relPath, subPackageMeta)) {
          await this.ctx.autoImportService.scanPotentialComponentEntries(absPath)
        }
        wxmlFiles.push({
          relPath,
          absPath,
          fileName,
        })
      }
      else if (isWxs) {
        wxsFiles.push({
          relPath,
          absPath,
          fileName,
        })
      }
      else if (isWorker) {
        this.cachedWorkerFiles.push({
          relPath,
          absPath,
          fileName,
        })
      }
      else {
        mediaFiles.push({
          relPath,
          absPath,
          fileName,
        })
      }
    }

    await Promise.all([
      ...wxsFiles.map(async ({ fileName, absPath }) => {
        const source = await fs.readFile(absPath)
        this.cachedEmittedFiles.push({
          type: 'asset',
          fileName,
          source,
        })
      }),
      ...mediaFiles.map(async ({ fileName, absPath }) => {
        const source = await fs.readFile(absPath)
        this.cachedEmittedFiles.push({
          type: 'asset',
          fileName,
          source,
        })
      }),
    ])

    debug?.(this.ctx.autoImportService.potentialComponentMap)

    // 独立分包
    if (subPackageMeta) {
      this.entriesSet = subPackageMeta.entriesSet
      this.entries = subPackageMeta.entries
    }
    else {
      // app 递归依赖
      await this.ctx.scanService.scanAppEntry()

      this.entriesSet = this.ctx.scanService.entriesSet
      this.entries = this.ctx.scanService.entries
      // 从 fdir 扫描结果中排除依赖 wxml
      const excludedWxmlFiles = wxmlFiles.filter((x) => {
        return !this.ctx.wxmlService.tokenMap.has(x.absPath)
      })
      // 是否是额外的 wxml
      const additionalWxmlFiles = excludedWxmlFiles.filter((x) => {
        return this.ctx.configService.weappViteConfig?.isAdditionalWxml?.(x.absPath)
      })
      debug?.(`additionalWxmlFiles:`, additionalWxmlFiles)
      await Promise.all(
        [
          ...Array.from(this.ctx.wxmlService.tokenMap.entries()).map(async ([wxmlFile, token]) => {
            const { deps, components, code } = handleWxml(token)
            const relPath = this.ctx.configService.relativeCwd(wxmlFile)
            const fileName = this.ctx.configService.relativeSrcRoot(relPath)

            await this.handleWxsDeps(deps, wxmlFile)
            debug?.(components)

            // 支持 html 后缀
            this.cachedEmittedFiles.push({
              type: 'asset',
              fileName,
              source: code,
            })
          }),
          ...additionalWxmlFiles.map(async ({ fileName, absPath }) => {
            const source = await fs.readFile(absPath, 'utf8')
            let finalSource
            if (weapp?.enhance?.wxml) {
              const { deps, components, code } = handleWxml(
                scanWxml(
                  source,
                  weapp.enhance.wxml === true ? {} : weapp.enhance.wxml,
                ),
              )
              finalSource = code
              await this.handleWxsDeps(deps, absPath)
              debug?.(components)
              this.ctx.wxmlService.setWxmlComponentsMap(absPath, components)
            }
            else {
              finalSource = source
            }

            this.cachedEmittedFiles.push({
              type: 'asset',
              fileName,
              source: finalSource,
            })
          }),
        ],

      )
    }

    const input = this.mergeInputOption([...this.entriesSet], options.input)
    options.input = input // input =
  }

  buildStart(pluginContext: PluginContext) {
    for (const filePath of this.cachedWatchFiles) {
      pluginContext.addWatchFile(filePath)
    }
    for (const emitFile of this.cachedEmittedFiles) {
      pluginContext.emitFile(emitFile)
    }
  }

  buildEnd(pluginContext: PluginContext) {
    this.addModulesHot(pluginContext)

    debug?.('buildEnd start')
    const watchFiles = pluginContext.getWatchFiles()
    debug?.('watchFiles count: ', watchFiles.length)

    for (const entry of this.entries) {
      if (entry.jsonPath) {
        pluginContext.addWatchFile(entry.jsonPath)
        if (entry.json) {
          const fileName = jsonFileRemoveJsExtension(
            this.ctx.configService.relativeSrcRoot(this.ctx.configService.relativeCwd(entry.jsonPath)),
          )
          pluginContext.emitFile({
            type: 'asset',
            fileName,
            source: this.ctx.jsonService.resolve(entry),
          })
        }
      }
      if (entry.type === 'app') {
        const appEntry = this.ctx.scanService.appEntry
        if (appEntry) {
          // sitemap.json
          if (appEntry.sitemapJsonPath) {
            pluginContext.addWatchFile(appEntry.sitemapJsonPath)
            if (appEntry.sitemapJson) {
              const fileName = jsonFileRemoveJsExtension(
                this.ctx.configService.relativeSrcRoot(this.ctx.configService.relativeCwd(appEntry.sitemapJsonPath)),
              )
              pluginContext.emitFile({
                type: 'asset',
                fileName,
                source: this.ctx.jsonService.resolve({
                  json: appEntry.sitemapJson,
                  jsonPath: appEntry.sitemapJsonPath,
                }),
              })
            }
          }
          // theme.json
          if (appEntry.themeJsonPath) {
            pluginContext.addWatchFile(appEntry.themeJsonPath)
            if (appEntry.themeJson) {
              const fileName = jsonFileRemoveJsExtension(
                this.ctx.configService.relativeSrcRoot(this.ctx.configService.relativeCwd(appEntry.themeJsonPath)),
              )
              pluginContext.emitFile({
                type: 'asset',
                fileName,
                source: this.ctx.jsonService.resolve({
                  json: appEntry.themeJson,
                  jsonPath: appEntry.themeJsonPath,
                }),
              })
            }
          }
        }
      }
    }
    if (this.ctx.scanService.workersDir && this.cachedWorkerFiles.length) {
      const workerFiles = this.ctx.scanService.workersBuild(
        this.cachedWorkerFiles.map(x => x.absPath),
      )
      if (workerFiles) {
        for (let i = 0; i < workerFiles.length; i++) {
          const workerFile = workerFiles[i]
          const fileName = this.ctx.configService.relativeSrcRoot(this.ctx.configService.relativeCwd(workerFile.absPath))

          pluginContext.emitFile({
            type: 'prebuilt-chunk',
            fileName,
            code: workerFile.text,
          })
        }
      }
    }

    debug?.('buildEnd end')
  }

  resolveId(id: string, _importer: string | undefined, options: {
    attributes: Record<string, string>
    custom?: CustomPluginOptions
    ssr?: boolean
    isEntry: boolean
  }): Promise<ResolveIdResult> | ResolveIdResult | undefined {
    if (id.endsWith('.wxss')) {
      return id.replace(/\.wxss$/, '.css?wxss')
    }
    else if (options.custom?.weappViteRequire) {
      return {
        id,
        moduleSideEffects: true,
      }
    }
  }

  async load(id: string, pluginContext: PluginContext): Promise<LoadResult> {
    if (this.entriesSet.has(id)) {
      const code = await fs.readFile(id, 'utf8')
      const ms = new MagicString(code)
      for (const ext of supportedCssLangs) {
        const mayBeCssPath = changeFileExtension(id, ext)

        if (await fs.exists(mayBeCssPath)) {
          pluginContext.addWatchFile(mayBeCssPath)
          ms.prepend(`import '${mayBeCssPath}'\n`)
        }
      }

      return {
        code: ms.toString(),
      }
    }
    else if (isCSSRequest(id)) {
      const parsed = parseRequest(id)
      const realPath = getCssRealPath(parsed)
      if (await fs.exists(realPath)) {
        const css = await fs.readFile(realPath, 'utf8')
        return {
          code: css,
        }
      }
    }
  }

  async generateBundle(bundle: OutputBundle, pluginContext: PluginContext) {
    debug?.('generateBundle start')
    const bundleKeys = Object.keys(bundle)
    await Promise.all(
      bundleKeys.map(async (bundleKey) => {
        const asset = bundle[bundleKey]
        if (asset.type === 'asset') {
          if (bundleKey.endsWith('.css')) {
            // 多个 js 文件 引入同一个样式的时候，此时 originalFileNames 是数组
            await Promise.all(asset.originalFileNames.map(async (originalFileName) => {
              if (isJsOrTs(originalFileName)) {
                const newFileName = this.ctx.configService.relativeSrcRoot(
                  changeFileExtension(originalFileName, this.ctx.configService.outputExtensions.wxss),
                )
                const css = await cssPostProcess(
                  asset.source.toString(),
                  { platform: this.ctx.configService.platform },
                )
                pluginContext.emitFile({
                  type: 'asset',
                  fileName: newFileName,
                  source: css,
                })
              }
            }))

            delete bundle[bundleKey]
          }
          else if (isTemplateRequest(bundleKey)) {
            const newFileName = changeFileExtension(bundleKey, this.ctx.configService.outputExtensions.wxml)
            if (newFileName !== bundleKey) {
              delete bundle[bundleKey]
              pluginContext.emitFile({
                type: 'asset',
                fileName: newFileName,
                source: asset.source,
              })
            }
          }
        }
      }),
    )
    debug?.('generateBundle end')
  }

  watchChange(id: string, change: { event: ChangeEvent }) {
    debouncedLoggerSuccess(`[${change.event}] ${this.ctx.configService.relativeCwd(id)}`)
  }
}
