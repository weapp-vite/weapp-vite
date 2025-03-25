import type { CompilerContext } from '@/context'
import type { SubPackageMetaValue, WeappVitePluginApi } from '@/types'
import type { Node } from 'estree'
import type { Plugin } from 'vite'
import { changeFileExtension, isJsOrTs } from '@/utils'
// import MagicString from 'magic-string'
import path from 'pathe'
import { collectRequireTokens } from './ast'
import { VitePluginService } from './VitePluginService'

// <wxs module="wxs" src="./test.wxs"></wxs>
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html

// https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html

// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/fileWatcher.ts#L2
// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/watch.ts#L174

export function vitePluginWeapp(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin<WeappVitePluginApi>[] {
  const service = new VitePluginService(ctx)
  // const p = []
  const api = {
    get ctx() {
      return ctx
    },
    get service() {
      return service
    },
  }
  return [
    {
      name: 'weapp-vite:pre',
      enforce: 'pre',
      api,
      // config->configResolved->|watching|options->buildStart
      // config(config, env) {
      //   debug?.(config, env)
      // },
      configResolved(config) {
        // https://github.com/vitejs/vite/blob/3400a5e258a597499c0f0808c8fca4d92eeabc17/packages/vite/src/node/plugins/css.ts#L6
        // debug?.(config)
        return service.configResolved(config)
      },
      options(options) {
        // @ts-ignore
        return service.options(options, subPackageMeta)
      },

      buildStart() {
        return service.buildStart(this)
      },
      async transform(code, id) {
        if (isJsOrTs(id)) {
          const ast = this.parse(code)
          // const ms = new MagicString(code)
          const { requireModules, requireTokens } = collectRequireTokens(ast as Node)
          // requireModules.filter(x => x.async).forEach((x) => {
          //   ms.prepend(`import('${x.value}');`)
          // })

          const dir = path.dirname(id)
          for (const token of requireModules) {
            const resolvedId = await this.resolve(
              path.resolve(dir, token.value),
              id,
              {
                custom: {
                  requireTokens,
                },
              },
            )

            if (resolvedId) {
              // resolvedId.moduleSideEffects = 'no-treeshake'
              const info = await this.load(resolvedId)

              // info.moduleSideEffects = 'no-treeshake'
              // console.log(info.code)
              this.emitFile(
                {
                  type: 'chunk',
                  id: info.id,
                  importer: id,
                  fileName: changeFileExtension(path.relative(ctx.configService.absoluteSrcRoot, path.resolve(dir, token.value)), 'js'),
                },
              )
              // 比如你扫描源码发现某个模块是通过字符串路径 require() 引入的，构建工具本身识别不了（不是静态 import），这时你可以用 emitFile 强制打包它：
            }
          }

          return {
            ast,
            code,
          }
        }
      },
      // moduleParsed(info) {
      //   // p.forEach(x => x())
      //   // p.length = 0
      // },

      buildEnd() {
        return service.buildEnd(this)
      },
      resolveId(id, importer, options) {
        return service.resolveId(id, importer, options)
      },
      load(id) {
        return service.load(id, this)
      },
      // for debug
      watchChange(id, change) {
        return service.watchChange(id, change)
      },
      writeBundle() {

      },
      generateBundle(_options, bundle) {
        return service.generateBundle(bundle, this)
      },
    },
    {
      // todo
      name: 'weapp-vite',
      api,
      // https://github.com/vitejs/vite/blob/3400a5e258a597499c0f0808c8fca4d92eeabc17/packages/vite/src/node/plugins/css.ts#L6
    },
    {
      // todo
      name: 'weapp-vite:post',
      enforce: 'post',
      api,
      // transform(code, id) {
      //   if (isJsOrTs(id)) {
      //     // const ast = this.parse(code)
      //     console.log(id, code)
      //   }
      // },
    },
  ]
}
