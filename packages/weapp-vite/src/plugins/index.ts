import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import type { ParseRequestResponse } from './parse'
import { addExtension, removeExtension } from '@weapp-core/shared'
import fg from 'fast-glob'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { isCSSRequest } from 'vite'
import { jsExtensions, supportedCssExtensions } from '../constants'
import { createDebugger } from '../debugger'
import { defaultExcluded } from '../defaults'
import { changeFileExtension } from '../utils'
import { parseRequest } from './parse'

const debug = createDebugger('weapp-vite:plugin')

function isJsOrTs(name?: string) {
  if (typeof name === 'string') {
    return jsExtensions.some(x => name.endsWith(`.${x}`))
  }
  return false
}

function getRealPath(res: ParseRequestResponse) {
  if (res.query.wxss) {
    return changeFileExtension(res.filename, 'wxss')
  }
  return res.filename
}
// <wxs module="wxs" src="./test.wxs"></wxs>
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html

// https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html

// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/fileWatcher.ts#L2
// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/watch.ts#L174
export function vitePluginWeapp(ctx: CompilerContext): Plugin[] {
  // const stylesIds = new Set<string>()
  // const templateIds = new Set<string>()
  // const templateCacheMap = new Map<string, {
  //   source: string
  //   deps: WxmlDep[]
  // }>()

  let configResolved: ResolvedConfig

  function relative(p: string) {
    return path.relative(configResolved.root, p)
  }
  function getInputOption(entries: string[]) {
    return entries
      .reduce<Record<string, string>>((acc, cur) => {
        acc[relative(cur)] = cur
        return acc
      }, {})
  }

  // TODO

  // const cacheInstance = createPluginCache(Object.create(null))
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
        await ctx.scanAppEntry()
        const input = getInputOption([...ctx.entriesSet])
        options.input = input
      },
      async buildStart() {
        const { root, build } = configResolved
        const cwd = root
        const ignore: string[] = [
          ...defaultExcluded,
        ]

        ignore.push(
          ...[
            `${build.outDir}/**`,
            'project.config.json',
            'project.private.config.json',
            'package.json',
            'tsconfig.json',
            'tsconfig.node.json',
          ],
        )
        const files = await fg(
          // 假如去 join root 就是返回 absolute
          [path.join(ctx.srcRoot ?? '', '**/*.{wxml,json,wxs,png,jpg,jpeg,gif,svg,webp}')],
          {
            cwd,
            ignore,
            absolute: false,
          },
        )
        const relFiles = files
        for (const file of relFiles) {
          const filepath = path.resolve(ctx.cwd, file)

          this.addWatchFile(filepath)
          const isMedia = !/\.(?:wxml|json|wxs)$/.test(file)
          this.emitFile({
            type: 'asset',
            fileName: ctx.relativeSrcRoot(file),
            source: isMedia ? await fs.readFile(filepath) : await fs.readFile(filepath, 'utf8'),
          })
        }
      },
      resolveId(source) {
        if (/\.wxss$/.test(source)) {
          return source.replace(/\.wxss$/, '.css?wxss')
        }
      },
      async load(id) {
        if (ctx.entriesSet.has(id)) {
          const base = removeExtension(id)
          const ms = new MagicString(fs.readFileSync(id, 'utf8'))
          for (const ext of supportedCssExtensions) {
            const mayBeCssPath = addExtension(base, ext)

            if (fs.existsSync(mayBeCssPath)) {
              this.addWatchFile(mayBeCssPath)
              ms.prepend(`import '${mayBeCssPath}'\n`)
            }
          }
          // const mayBeWxmlPath = addExtension(base, '.wxml')
          // if (fs.existsSync(mayBeWxmlPath)) {
          //   this.addWatchFile(mayBeWxmlPath)
          //   ms.prepend(`import '${mayBeWxmlPath}'\n`)

          // const source = fs.readFileSync(mayBeWxmlPath, 'utf8')
          // const { deps } = getDeps(source)
          // templateCacheMap.set(id, {
          //   deps,
          //   source,
          // })
          // deps.filter(x => x.tagName === 'import' || x.tagName === 'include').map(x => x.name === 'src')
          // }

          return {
            code: ms.toString(),
          }
        }
        else if (isCSSRequest(id)) {
          // stylesIds.add(id)
          const parsed = parseRequest(id)
          const realPath = getRealPath(parsed)
          if (await fs.exists(realPath)) {
            const css = await fs.readFile(realPath, 'utf8')
            return {
              code: css,
            }
          }
        }
      },
      // for debug
      // watchChange(id, change) {
      //   console.log(id, change)
      // },
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
