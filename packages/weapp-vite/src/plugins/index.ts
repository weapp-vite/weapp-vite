import type { CompilerContext } from '@/context'
import type { SubPackageMetaValue, WeappVitePluginApi } from '@/types'
import type { Plugin } from 'vite'
import { VitePluginService } from './VitePluginService'

// <wxs module="wxs" src="./test.wxs"></wxs>
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html

// https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html

// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/fileWatcher.ts#L2
// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/watch.ts#L174

export function vitePluginWeapp(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin<WeappVitePluginApi>[] {
  const service = new VitePluginService(ctx)
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
        return service.preConfigResolved(config)
      },
      options(options) {
        return service.preOptions(options, subPackageMeta)
      },

      buildStart() {
        return service.preBuildStart(this)
      },

      buildEnd() {
        return service.preBuildEnd(this)
      },
      resolveId(id) {
        return service.preResolveId(id)
      },
      load(id) {
        return service.preLoad(id, this)
      },
      // for debug
      watchChange(id, change) {
        return service.preWatchChange(id, change)
      },
      generateBundle(_options, bundle) {
        return service.preGenerateBundle(bundle, this)
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
    },
  ]
}
