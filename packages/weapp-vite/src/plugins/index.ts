import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext, Entry, SubPackageMetaValue } from '../context'
import { addExtension, removeExtension } from '@weapp-core/shared'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { isCSSRequest } from 'vite'
import { supportedCssExtensions } from '../constants'
import { createDebugger } from '../debugger'
import { defaultExcluded } from '../defaults'
import logger from '../logger'
import { changeFileExtension, isJsOrTs, resolveJson } from '../utils'
import { getCssRealPath, parseRequest } from './parse'

const debug = createDebugger('weapp-vite:plugin')

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
      api: {

      },
      // config->configResolved->|watching|options->buildStart
      config(config, env) {
        debug?.(config, env)
      },
      configResolved(config) {
        debug?.(config)
        configResolved = config
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
        options.input = input
      },
      async buildStart() {
        const { build } = configResolved

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
        const baseDir = ctx.srcRoot ?? ''
        const targetDir = subPackageMeta ? path.join(baseDir, subPackageMeta.subPackage.root) : baseDir
        const patterns = [
          path.join(
            targetDir,
            '**/*.{wxml,wxs,png,jpg,jpeg,gif,svg,webp}',
          ),
        ]
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
          this.emitFile({
            type: 'asset',
            fileName: ctx.relativeSrcRoot(file),
            source: isMedia ? await fs.readFile(filepath) : await fs.readFile(filepath, 'utf8'),
          })
        }
        for (const entry of entries) {
          if (entry.jsonPath) {
            this.addWatchFile(entry.jsonPath)
            if (entry.json) {
              const fileName = ctx.relativeSrcRoot(path.relative(ctx.cwd, entry.jsonPath))
              this.emitFile({
                type: 'asset',
                fileName,
                source: resolveJson(entry.json),
              })
            }
          }
        }
      },
      resolveId(source) {
        if (/\.wxss$/.test(source)) {
          return source.replace(/\.wxss$/, '.css?wxss')
        }
      },
      async load(id) {
        if (entriesSet.has(id)) {
          const base = removeExtension(id)
          const ms = new MagicString(fs.readFileSync(id, 'utf8'))
          for (const ext of supportedCssExtensions) {
            const mayBeCssPath = addExtension(base, ext)

            if (fs.existsSync(mayBeCssPath)) {
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
        logger.success(`[${change.event}] ${transformAbsoluteToRelative(id)}`)
      },
      generateBundle(_options, bundle) {
        const bundleKeys = Object.keys(bundle)
        for (const bundleKey of bundleKeys) {
          const asset = bundle[bundleKey]
          if (bundleKey.endsWith('.css') && asset.type === 'asset' && typeof asset.originalFileName === 'string' && isJsOrTs(asset.originalFileName)) {
            const newFileName = ctx.relativeSrcRoot(
              changeFileExtension(asset.originalFileName, 'wxss'),
            )
            this.emitFile({
              type: 'asset',
              fileName: newFileName,
              source: asset.source,
            })
            delete bundle[bundleKey]
          }
        }
      },
      // writeBundle(options, bundle) {
      //   console.log(options, bundle)
      // },
    },
    {
      name: 'weapp-vite',
    },
    {
      name: 'weapp-vite:post',
      enforce: 'post',
    },
  ]
}
