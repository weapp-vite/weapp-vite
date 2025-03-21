import type { CompilerContext } from '@/context'
import type { AppEntry, Entry, WeappVitePluginApi } from '@/types'
import type { Plugin } from 'vite'
import { handleWxml } from '@/wxml'
import { changeFileExtension, fs, path, removeExtensionDeep } from '@weapp-core/shared'
import { VitePluginService } from './VitePluginServiceNext'

export function vitePluginWeapp(ctx: CompilerContext): Plugin<WeappVitePluginApi>[] {
  const service = new VitePluginService(ctx)

  return [
    {
      name: 'weapp-vite:pre',
      enforce: 'pre',
      configResolved(config) {
        service.preConfigResolved(config)
      },
      options(options) {
        return service.preOptions(options)
      },
      async transform(code, id, options) {
        // const ast = this.parse(code)
        const isAppEntry = id === service.appEntry.path
        if (isAppEntry) {
          await service.loadAppDeps(this)
        }
        if (service.entriesMap.has(id)) {
          const entry = service.entriesMap.get(id)

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
                },
              )
              const res = await ctx.wxmlService.scan(entry.templatePath)
              if (res) {
                const { code } = handleWxml(res)
                this.emitFile(
                  {
                    type: 'asset',
                    fileName: path.relative(ctx.configService.absoluteSrcRoot, entry.templatePath),
                    source: code,
                  },
                )
              }
            }
            else if (entry.type === 'app') {
              const jsonPath = entry.jsonPath ? entry.jsonPath : changeFileExtension(id, 'json')
              this.emitFile(
                {
                  type: 'asset',
                  fileName: path.relative(ctx.configService.absoluteSrcRoot, jsonPath),
                  source: ctx.jsonService.resolve(entry),
                },
              )
            }
            else if (entry.type === 'component') {
              const jsonPath = entry.jsonPath ? entry.jsonPath : changeFileExtension(id, 'json')
              this.emitFile(
                {
                  type: 'asset',
                  fileName: path.relative(ctx.configService.absoluteSrcRoot, jsonPath),
                  source: ctx.jsonService.resolve(entry),
                },
              )
              const res = await ctx.wxmlService.scan(entry.templatePath)
              if (res) {
                const { code } = handleWxml(res)
                this.emitFile(
                  {
                    type: 'asset',
                    fileName: path.relative(ctx.configService.absoluteSrcRoot, entry.templatePath),
                    source: code,
                  },
                )
              }
            }
          }
        }
      },
      async load(id) {

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
