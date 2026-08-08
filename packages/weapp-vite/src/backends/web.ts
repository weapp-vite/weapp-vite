import type { PlatformBackend } from './types'

export const webBackend: PlatformBackend = {
  descriptor: {
    id: 'web',
    aliases: Object.freeze(['web', 'h5']),
    runtime: 'web',
    capabilities: Object.freeze({
      build: true,
      dev: true,
      ide: false,
      analyze: true,
      npm: false,
      workers: false,
      lib: false,
    }),
  },
  driver: {
    createInlineConfig({ host }) {
      if (host === undefined) {
        return undefined
      }
      return {
        server: {
          host,
        },
      }
    },
    mergeConfig(context, ...configs) {
      return context.merge(...configs)
    },
    async build(ctx) {
      return await ctx.webService.build()
    },
    async dev(ctx) {
      return await ctx.webService.startDevServer()
    },
    async close(ctx) {
      await ctx.webService.close()
    },
    resolvePlatformAlias() {
      return 'web'
    },
  },
}
