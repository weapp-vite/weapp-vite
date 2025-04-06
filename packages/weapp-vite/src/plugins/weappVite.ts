import type { CompilerContext } from '@/context'
import type { SubPackageMetaValue } from '@/types'
import type { Plugin } from 'vite'
import { VitePluginService } from './VitePluginService'

export function weappVite(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin[] {
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

        return service.configResolved(config)
      },
      options(options) {
        return service.options(options, subPackageMeta)
      },

      buildStart() {
        return service.buildStart(
          // @ts-ignore
          this,
        )
      },

      buildEnd() {
        return service.buildEnd(
          // @ts-ignore
          this,
        )
      },
      resolveId(id, importer, options) {
        return service.resolveId(id, importer, options)
      },
      load(id) {
        return service.load(
          id,
          // @ts-ignore
          this,
        )
      },
      // for debug
      watchChange(id, change) {
        return service.watchChange(id, change)
      },
      generateBundle(_options, bundle) {
        return service.generateBundle(
          bundle,
          // @ts-ignore
          this,
        )
      },
    },
  ]
}
