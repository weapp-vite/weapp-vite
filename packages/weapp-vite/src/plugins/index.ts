import type { CompilerContext } from '@/context'
import type { AppEntry, Entry, WeappVitePluginApi } from '@/types'
import type { Plugin } from 'vite'
import { changeFileExtension, fs, path, removeExtensionDeep } from '@weapp-core/shared'
import { handleWxml } from '@/wxml'

export function vitePluginWeapp(ctx: CompilerContext): Plugin<WeappVitePluginApi>[] {
  const entriesMap = new Map<string, Entry>()

  let appEntry: AppEntry
  return [
    {
      name: 'weapp-vite:pre',
      enforce: 'pre',
      configResolved(config) {
        const idx = config.plugins?.findIndex(x => x.name === 'vite:build-import-analysis')
        if (idx > -1) {
          (config.plugins as Plugin<any>[]).splice(idx, 1)
        }
      },
      options: {
        async handler(options) {
          const _appEntry = await ctx.scanService.loadAppEntry()
          if (_appEntry) {
            appEntry = _appEntry
            options.input = appEntry.path
            // !!! app entry 不加入
            // inputSet.add(appEntry.path)
            entriesMap.set(appEntry.path, appEntry)
          }
        },
      },

      async transform(code, id, options) {

        console.log('transform', id)
        // const ast = this.parse(code)
        if (appEntry.path === id) {
          for (const page of appEntry.json?.pages ?? []) {
            const entry = await ctx.scanService.loadPageEntry(page)
            if (entry) {
              const resolveId = await this.resolve(entry.path)
              if (resolveId) {
                entriesMap.set(entry.path, entry)
                await this.load(resolveId)

              }
            }
          }
        }
        if (entriesMap.has(id)) {
          const entry = entriesMap.get(id)
          const isAppEntry = id === appEntry.path
          if (!isAppEntry) {
            const name = removeExtensionDeep(path.relative(ctx.configService.absoluteSrcRoot, id))
            this.emitFile(
              {
                type: 'chunk',
                id,
                name,
              },
            )
          }
          if (entry) {
            if (entry.type === 'page') {
              const jsonPath = entry.jsonPath ? entry.jsonPath : changeFileExtension(id, 'json')
              this.emitFile(
                {
                  type: 'asset',
                  fileName: path.relative(ctx.configService.absoluteSrcRoot, jsonPath),
                  source: ctx.jsonService.resolve(entry),
                }
              )
              const res = await ctx.wxmlService.scan(entry.templatePath)
              if (res) {
                const { code } = handleWxml(res)
                this.emitFile(
                  {
                    type: 'asset',
                    fileName: path.relative(ctx.configService.absoluteSrcRoot, entry.templatePath),
                    source: code,
                  }
                )
              }
            } else if (entry.type === 'app') {
              const jsonPath = entry.jsonPath ? entry.jsonPath : changeFileExtension(id, 'json')
              this.emitFile(
                {
                  type: 'asset',
                  fileName: path.relative(ctx.configService.absoluteSrcRoot, jsonPath),
                  source: ctx.jsonService.resolve(entry),
                }
              )
            } else if (entry.type === 'component') {
              const jsonPath = entry.jsonPath ? entry.jsonPath : changeFileExtension(id, 'json')
              this.emitFile(
                {
                  type: 'asset',
                  fileName: path.relative(ctx.configService.absoluteSrcRoot, jsonPath),
                  source: ctx.jsonService.resolve(entry),
                }
              )
              const res = await ctx.wxmlService.scan(entry.templatePath)
              if (res) {
                const { code } = handleWxml(res)
                this.emitFile(
                  {
                    type: 'asset',
                    fileName: path.relative(ctx.configService.absoluteSrcRoot, entry.templatePath),
                    source: code,
                  }
                )
              }
            }
          }

        }

        // return {
        //   ast,
        //   code
        // }
      },
      async load(id) {
        console.log('load', id)
        // if (appEntry.path === id) {
        //   for (const page of appEntry.json?.pages ?? []) {
        //     const entry = await ctx.scanService.loadPageEntry(page)
        //     if (entry) {
        //       const resolveId = await this.resolve(entry.path)
        //       if (resolveId) {
        //         const info = await this.load(resolveId)
        //         if (info) {
        //           entriesMap.set(entry.path, entry)
        //         }
        //       }
        //     }
        //   }
        // }
      },

      // https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
      // 允许上传的文件
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
      generateBundle: {
        handler(options, bundle, isWrite) {
          console.debug('generateBundle', options, bundle, isWrite)
        },
      },
    },
  ]
}
