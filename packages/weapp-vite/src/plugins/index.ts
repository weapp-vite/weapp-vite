import type { EmittedFile } from 'rollup'
import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context/index'
import type { Entry, SubPackageMetaValue } from '../types'
import { isObject, removeExtension } from '@weapp-core/shared'
import debounce from 'debounce'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { isCSSRequest } from 'vite'
import { jsExtensions, supportedCssLangs } from '../constants'
import { createDebugger } from '../debugger'
import { defaultExcluded } from '../defaults'
import logger from '../logger'
import { cssPostProcess } from '../postcss'
import { changeFileExtension, isJsOrTs, jsonFileRemoveJsExtension, resolveGlobs, resolveJson } from '../utils'
import { handleWxml, scanWxml } from '../wxml'
import { transformWxsCode } from '../wxs'
import { getCssRealPath, parseRequest } from './parse'

const debug = createDebugger('weapp-vite:plugin')

function isEmptyObject(obj: any) {
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      return false
    }
  }
  return true
}

function isTemplateRequest(request: string) {
  return request.endsWith('.wxml') || request.endsWith('.html')
}

export interface IFileMeta {
  relPath: string
  absPath: string
  fileName: string
}

const debouncedLoggerSuccess = debounce((message: string) => {
  return logger.success(message)
}, 25)
// <wxs module="wxs" src="./test.wxs"></wxs>
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html

// https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html

// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/fileWatcher.ts#L2
// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/watch.ts#L174
export function vitePluginWeapp(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin[] {
  let configResolved: ResolvedConfig

  function getInputOption(entries: string[]) {
    return entries
      .reduce<Record<string, string>>((acc, cur) => {
        acc[ctx.configService.relativeCwd(cur)] = cur
        return acc
      }, {})
  }
  let entriesSet: Set<string>
  let entries: Entry[]
  const cachedEmittedFiles: EmittedFile[] = []
  const cachedWatchFiles: string[] = []
  // let autoImportFilter = (_id: string) => false
  return [
    {
      name: 'weapp-vite:pre',
      enforce: 'pre',
      // config->configResolved->|watching|options->buildStart
      // config(config, env) {
      //   debug?.(config, env)
      // },
      configResolved(config) {
        // https://github.com/vitejs/vite/blob/3400a5e258a597499c0f0808c8fca4d92eeabc17/packages/vite/src/node/plugins/css.ts#L6
        // debug?.(config)
        configResolved = config

        if (isObject(configResolved.env)) {
          for (const [key, value] of Object.entries(configResolved.env)) {
            ctx.configService.setDefineEnv(key, value)
          }
        }
      },
      async options(options) {
        // clear cache
        cachedEmittedFiles.length = 0
        cachedWatchFiles.length = 0
        ctx.scanService.resetAutoImport()

        const { build, weapp } = configResolved

        const ignore: string[] = [
          ...defaultExcluded,
          `${build.outDir}/**`,
        ]

        // app 忽略独立分包
        if (!subPackageMeta) {
          for (const subPackageRoot of Object.keys(ctx.subPackageService.metaMap)) {
            ignore.push(path.join(subPackageRoot, '**'))
          }
        }

        ignore.push(...resolveGlobs(weapp?.copy?.exclude))
        // 独立分包只 copy 分包部分，否则是主包和普通分包
        const targetDir = subPackageMeta ? path.join(ctx.configService.srcRoot, subPackageMeta.subPackage.root) : ctx.configService.srcRoot

        const assetGlobs = [
          // 支持 html
          '**/*.{wxml,html,wxs}',
          '**/*.{png,jpg,jpeg,gif,svg,webp}',
        ]

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
              cwd: ctx.configService.cwd,
              ignore,
              windows: true,
              posixSlashes: true,
            },
          )
          .crawl(ctx.configService.cwd)
          .withPromise()

        const wxmlFiles: IFileMeta[] = []
        const wxsFiles: IFileMeta[] = []
        const mediaFiles: IFileMeta[] = []
        for (const relPath of relFiles) {
          const absPath = path.resolve(ctx.configService.cwd, relPath)
          cachedWatchFiles.push(absPath)
          const isWxs = relPath.endsWith('.wxs')
          const fileName = ctx.configService.relativeSrcRoot(relPath)
          if (isTemplateRequest(relPath)) {
            if (weapp?.enhance?.autoImportComponents && ctx.autoImportService.filter(relPath, subPackageMeta)) {
              await ctx.autoImportService.scanPotentialComponentEntries(absPath)
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
          else {
            mediaFiles.push({
              relPath,
              absPath,
              fileName,
            })
          }
        }

        await Promise.all([
          ...wxmlFiles.map(async ({ fileName, absPath }) => {
            const source = await fs.readFile(absPath, 'utf8')
            let _source
            if (weapp?.enhance?.wxml) {
              const { deps, components, code } = handleWxml(scanWxml(source, weapp.enhance.wxml === true ? {} : weapp.enhance.wxml))

              _source = code
              for (const wxsDep of deps.filter(x => x.tagName === 'wxs')) {
                // only ts and js
                if (jsExtensions.includes(wxsDep.attrs.lang) || /\.wxs\.[jt]s$/.test(wxsDep.value)) {
                  const wxsPath = path.resolve(path.dirname(absPath), wxsDep.value)
                  if (await fs.exists(wxsPath)) {
                    cachedWatchFiles.push(wxsPath)
                    const code = await fs.readFile(wxsPath, 'utf8')
                    const res = transformWxsCode(code, {
                      filename: wxsPath,
                    })
                    if (res?.code) {
                      cachedEmittedFiles.push(
                        {
                          type: 'asset',
                          fileName: ctx.configService.relativeSrcRoot(ctx.configService.relativeCwd(removeExtension(wxsPath))),
                          source: res.code,
                        },
                      )
                    }
                  }
                }
              }
              debug?.(components)
              if (!isEmptyObject(components)) {
                ctx.scanService.wxmlComponentsMap.set(removeExtension(absPath), components)
              }
            }
            else {
              _source = source
            }

            // 支持 html 后缀
            cachedEmittedFiles.push({
              type: 'asset',
              fileName,
              source: _source,
            })
          }),
          ...wxsFiles.map(async ({ fileName, absPath }) => {
            const source = await fs.readFile(absPath)
            cachedEmittedFiles.push({
              type: 'asset',
              fileName,
              source,
            })
          }),
          ...mediaFiles.map(async ({ fileName, absPath }) => {
            const source = await fs.readFile(absPath)
            cachedEmittedFiles.push({
              type: 'asset',
              fileName,
              source,
            })
          }),
        ])

        debug?.(ctx.autoImportService.potentialComponentMap)

        // 独立分包
        if (subPackageMeta) {
          entriesSet = subPackageMeta.entriesSet
          entries = subPackageMeta.entries
        }
        else {
          // app 递归依赖
          await ctx.scanService.scanAppEntry()

          entriesSet = ctx.scanService.entriesSet
          entries = ctx.scanService.entries
        }

        const input = getInputOption([...entriesSet])
        options.input = input // ctx.input =
      },

      buildStart() {
        for (const filePath of cachedWatchFiles) {
          this.addWatchFile(filePath)
        }
        for (const emitFile of cachedEmittedFiles) {
          this.emitFile(emitFile)
        }
      },

      async buildEnd() {
        // 热更新加载
        for (const entry of entriesSet) {
          const moduleInfo = this.getModuleInfo(entry)

          if (moduleInfo) {
            const stack = [moduleInfo.id] // 用栈模拟递归
            const visitedModules = new Set<string>()

            while (stack.length > 0) {
              const id = stack.pop()

              if (id && !visitedModules.has(id)) {
                visitedModules.add(id)

                const info = this.getModuleInfo(id)

                if (info) {
                  this.addWatchFile(info.id)
                  // 将子依赖加入栈
                  stack.push(...info.importedIds)
                }
              }
            }
          }
        }

        debug?.('buildEnd start')
        const watchFiles = this.getWatchFiles()
        debug?.('watchFiles count: ', watchFiles.length)

        for (const entry of entries) {
          if (entry.jsonPath) {
            this.addWatchFile(entry.jsonPath)
            if (entry.json) {
              const fileName = jsonFileRemoveJsExtension(ctx.configService.relativeSrcRoot(ctx.configService.relativeCwd(entry.jsonPath)))
              this.emitFile({
                type: 'asset',
                fileName,
                source: resolveJson(entry, ctx.configService.aliasEntries),
              })
            }
          }
          if (entry.type === 'app') {
            const appEntry = ctx.scanService.appEntry
            if (appEntry) {
              // sitemap.json
              if (appEntry.sitemapJsonPath) {
                this.addWatchFile(appEntry.sitemapJsonPath)
                if (appEntry.sitemapJson) {
                  const fileName = jsonFileRemoveJsExtension(
                    ctx.configService.relativeSrcRoot(ctx.configService.relativeCwd(appEntry.sitemapJsonPath)),
                  )
                  this.emitFile({
                    type: 'asset',
                    fileName,
                    source: resolveJson({
                      json: appEntry.sitemapJson,
                      jsonPath: appEntry.sitemapJsonPath,
                    }, ctx.configService.aliasEntries),
                  })
                }
              }
              // theme.json
              if (appEntry.themeJsonPath) {
                this.addWatchFile(appEntry.themeJsonPath)
                if (appEntry.themeJson) {
                  const fileName = jsonFileRemoveJsExtension(
                    ctx.configService.relativeSrcRoot(ctx.configService.relativeCwd(appEntry.themeJsonPath)),
                  )
                  this.emitFile({
                    type: 'asset',
                    fileName,
                    source: resolveJson({
                      json: appEntry.themeJson,
                      jsonPath: appEntry.themeJsonPath,
                    }, ctx.configService.aliasEntries),
                  })
                }
              }
            }
          }
        }
        debug?.('buildEnd end')
      },
      resolveId(source) {
        if (/\.wxss$/.test(source)) {
          return source.replace(/\.wxss$/, '.css?wxss')
        }
      },
      async load(id) {
        if (entriesSet.has(id)) {
          const code = await fs.readFile(id, 'utf8')
          const ms = new MagicString(code)
          for (const ext of supportedCssLangs) {
            const mayBeCssPath = changeFileExtension(id, ext)

            if (await fs.exists(mayBeCssPath)) {
              this.addWatchFile(mayBeCssPath)
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
      },
      // for debug
      watchChange(id, change) {
        debouncedLoggerSuccess(`[${change.event}] ${ctx.configService.relativeCwd(id)}`)
      },
      async generateBundle(_options, bundle) {
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
                    const newFileName = ctx.configService.relativeSrcRoot(
                      changeFileExtension(originalFileName, ctx.configService.outputExtensions.wxss),
                    )
                    const css = await cssPostProcess(
                      asset.source.toString(),
                      { platform: ctx.configService.platform },
                    )
                    this.emitFile({
                      type: 'asset',
                      fileName: newFileName,
                      source: css,
                    })
                  }
                }))

                delete bundle[bundleKey]
              }
              else if (isTemplateRequest(bundleKey)) {
                const newFileName = changeFileExtension(bundleKey, ctx.configService.outputExtensions.wxml)
                if (newFileName !== bundleKey) {
                  delete bundle[bundleKey]
                  this.emitFile({
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
      },
    },
    {
      // todo
      name: 'weapp-vite',
      // https://github.com/vitejs/vite/blob/3400a5e258a597499c0f0808c8fca4d92eeabc17/packages/vite/src/node/plugins/css.ts#L6
    },
    {
      // todo
      name: 'weapp-vite:post',
      enforce: 'post',
    },
  ]
}
