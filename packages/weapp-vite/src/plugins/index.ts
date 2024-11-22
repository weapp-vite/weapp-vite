import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import type { Entry, SubPackageMetaValue } from '../types'
import { isObject, removeExtension } from '@weapp-core/shared'
import debounce from 'debounce'
// import type { WxmlDep } from '../utils'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { isCSSRequest } from 'vite'
import { jsExtensions, supportedCssLangs } from '../constants'
import { createDebugger } from '../debugger'
import { defaultExcluded } from '../defaults'
import logger from '../logger'
import { changeFileExtension, isJsOrTs, jsonFileRemoveJsExtension, resolveGlobs, resolveJson } from '../utils'
import { processWxml } from '../wxml'
import { transformWxsCode } from '../wxs'
import { getCssRealPath, parseRequest } from './parse'

const debug = createDebugger('weapp-vite:plugin')

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

  function relative(p: string) {
    return path.relative(configResolved.root, p)
  }

  function transformAbsoluteToRelative(p: string) {
    if (path.isAbsolute(p)) {
      return relative(p)
    }
    return p
  }

  function getInputOption(entries: string[]) {
    return entries
      .reduce<Record<string, string>>((acc, cur) => {
        acc[relative(cur)] = cur
        return acc
      }, {})
  }
  let entriesSet: Set<string>
  let entries: Entry[]
  return [
    {
      name: 'weapp-vite:pre',
      enforce: 'pre',
      // config->configResolved->|watching|options->buildStart
      // config(config, env) {
      //   debug?.(config, env)
      // },
      configResolved(config) {
        // debug?.(config)
        configResolved = config
        if (isObject(configResolved.env)) {
          for (const [key, value] of Object.entries(configResolved.env)) {
            ctx.setDefineEnv(key, value)
          }
        }
      },
      async options(options) {
        // 独立分包
        if (subPackageMeta) {
          entriesSet = subPackageMeta.entriesSet
          entries = subPackageMeta.entries
        }
        else {
          // app 递归依赖
          await ctx.scanAppEntry()
          entriesSet = ctx.entriesSet
          entries = ctx.entries
        }
        const input = getInputOption([...entriesSet])
        options.input = input // ctx.input =
      },

      async buildStart() {
        const { build, weapp } = configResolved

        const ignore: string[] = [
          ...defaultExcluded,
          `${build.outDir}/**`,
        ]

        // app 忽略独立分包
        if (!subPackageMeta) {
          for (const root of Object.keys(ctx.subPackageMeta)) {
            ignore.push(path.join(root, '**'))
          }
        }

        ignore.push(...resolveGlobs(weapp?.copy?.exclude))
        // 独立分包只 copy 分包部分，否则是主包和普通分包
        const targetDir = subPackageMeta ? path.join(ctx.srcRoot, subPackageMeta.subPackage.root) : ctx.srcRoot

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
              cwd: ctx.cwd,
              ignore,
            },
          )
          .crawl(ctx.cwd)
          .withPromise()

        for (const file of relFiles) {
          const filepath = path.resolve(ctx.cwd, file)

          this.addWatchFile(filepath)
          const isMedia = !/\.(?:wxml|wxs)$/.test(file)
          const isWxml = /\.wxml$/.test(file)
          const isHtml = /\.html$/.test(file)
          const source = isMedia ? await fs.readFile(filepath) : await fs.readFile(filepath, 'utf8')
          const fileName = ctx.relativeSrcRoot(file)
          if (isHtml || isWxml) {
            let _source
            if (weapp?.enhance?.wxml) {
              const { code, deps } = processWxml(source)
              _source = code
              for (const wxsDep of deps.filter(x => x.tagName === 'wxs')) {
                // only ts and js
                if (jsExtensions.includes(wxsDep.attrs.lang) || /\.wxs\.[jt]s$/.test(wxsDep.value)) {
                  const wxsPath = path.resolve(path.dirname(filepath), wxsDep.value)
                  if (await fs.exists(wxsPath)) {
                    this.addWatchFile(wxsPath)
                    const code = await fs.readFile(wxsPath, 'utf8')
                    const res = transformWxsCode(code, {
                      filename: wxsPath,
                    })
                    if (res && res.code) {
                      this.emitFile({
                        type: 'asset',
                        fileName: ctx.relativeSrcRoot(relative(removeExtension(wxsPath))),
                        source: res.code,
                      })
                    }
                  }
                }
              }
            }
            else {
              _source = source
            }

            // 支持 html 后缀
            this.emitFile({
              type: 'asset',
              fileName: isHtml ? changeFileExtension(fileName, ctx.outputExtensions.wxml) : fileName,
              source: _source,
            })
          }
          else {
            this.emitFile({
              type: 'asset',
              fileName,
              source,
            })
          }
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
              const fileName = jsonFileRemoveJsExtension(ctx.relativeSrcRoot(path.relative(ctx.cwd, entry.jsonPath)))
              this.emitFile({
                type: 'asset',
                fileName,
                source: resolveJson(entry, ctx.aliasEntries),
              })
            }
          }
          if (entry.type === 'app') {
            const appEntry = ctx.appEntry
            if (appEntry) {
              // sitemap.json
              if (appEntry.sitemapJsonPath) {
                this.addWatchFile(appEntry.sitemapJsonPath)
                if (appEntry.sitemapJson) {
                  const fileName = jsonFileRemoveJsExtension(ctx.relativeSrcRoot(path.relative(ctx.cwd, appEntry.sitemapJsonPath)))
                  this.emitFile({
                    type: 'asset',
                    fileName,
                    source: resolveJson({
                      json: appEntry.sitemapJson,
                      jsonPath: appEntry.sitemapJsonPath,
                    }, ctx.aliasEntries),
                  })
                }
              }
              // theme.json
              if (appEntry.themeJsonPath) {
                this.addWatchFile(appEntry.themeJsonPath)
                if (appEntry.themeJson) {
                  const fileName = jsonFileRemoveJsExtension(ctx.relativeSrcRoot(path.relative(ctx.cwd, appEntry.themeJsonPath)))
                  this.emitFile({
                    type: 'asset',
                    fileName,
                    source: resolveJson({
                      json: appEntry.themeJson,
                      jsonPath: appEntry.themeJsonPath,
                    }, ctx.aliasEntries),
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
        // const watchFiles = this.getWatchFiles()
        // debug?.('watchChange watchFiles count: ', watchFiles.length)
        debouncedLoggerSuccess(`[${change.event}] ${transformAbsoluteToRelative(id)}`)
        // const watchFiles = this.getWatchFiles()
        // console.log(watchFiles)
      },
      // renderStart() {
      //   const watchFiles = this.getWatchFiles()
      //   debug?.('renderStart watchFiles count: ', watchFiles.length)
      // },
      // transform(code, id, options) {
      //   console.log(id)
      // },
      // 调试监听
      // buildEnd() {

      // },
      // renderChunk() {
      //   const watchFiles = this.getWatchFiles()
      //   debug?.('renderChunk watchFiles count: ', watchFiles.length)
      // },
      // augmentChunkHash() {
      //   const watchFiles = this.getWatchFiles()
      //   debug?.('augmentChunkHash watchFiles count: ', watchFiles.length)
      // },
      generateBundle(_options, bundle) {
        // const watchFiles = this.getWatchFiles()
        // debug?.('generateBundle watchFiles count: ', watchFiles.length)
        debug?.('generateBundle start')
        const bundleKeys = Object.keys(bundle)
        for (const bundleKey of bundleKeys) {
          const asset = bundle[bundleKey]
          if (bundleKey.endsWith('.css') && asset.type === 'asset') {
            // 多个 js 文件 引入同一个样式的时候，此时 originalFileNames 是数组
            for (const originalFileName of asset.originalFileNames) {
              if (isJsOrTs(originalFileName)) {
                const newFileName = ctx.relativeSrcRoot(
                  changeFileExtension(originalFileName, ctx.outputExtensions.wxss),
                )
                this.emitFile({
                  type: 'asset',
                  fileName: newFileName,
                  source: asset.source,
                })
              }
            }

            delete bundle[bundleKey]
          }
        }
        debug?.('generateBundle end')
      },
      // writeBundle() {
      //   const watchFiles = this.getWatchFiles()
      //   debug?.('writeBundle watchFiles count: ', watchFiles.length)
      // },
    },
    {
      // todo
      name: 'weapp-vite',
    },
    {
      // todo
      name: 'weapp-vite:post',
      enforce: 'post',
    },
  ]
}
