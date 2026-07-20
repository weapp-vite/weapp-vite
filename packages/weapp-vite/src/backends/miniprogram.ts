import type { PlatformBackend } from './types'
import { MINI_PROGRAM_PLATFORM_DESCRIPTORS, resolveMiniProgramPlatform } from '@weapp-core/shared'
import { createBuildScopeConfigFromCli } from '../runtime/buildScope'

const aliases = Object.freeze(
  Array.from(new Set(MINI_PROGRAM_PLATFORM_DESCRIPTORS.flatMap(descriptor => descriptor.aliases))),
)

export const miniprogramBackend: PlatformBackend = {
  descriptor: {
    id: 'miniprogram',
    aliases,
    runtime: 'miniprogram',
    capabilities: Object.freeze({
      build: true,
      dev: true,
      ide: true,
      analyze: true,
      npm: true,
      workers: true,
      lib: true,
    }),
  },
  driver: {
    createInlineConfig({ execution, platform, scope }) {
      const buildScope = createBuildScopeConfigFromCli(scope)
      const runsWeb = execution.get('web') !== undefined
      const miniPlatform = platform === 'web' ? undefined : platform
      const config = miniPlatform || buildScope || runsWeb
        ? {
            ...(miniPlatform || buildScope
              ? {
                  weapp: {
                    ...(miniPlatform ? { platform: miniPlatform } : {}),
                    ...(buildScope ? { buildScope } : {}),
                  },
                }
              : {}),
            ...(runsWeb
              ? {
                  build: {
                    watch: {},
                  },
                  server: {
                    port: 0,
                    watch: {
                      usePolling: true,
                      interval: 100,
                    },
                  },
                }
              : {}),
          }
        : undefined
      return config
    },
    mergeConfig(context, ...configs) {
      return context.merge(...configs)
    },
    async build(ctx, options) {
      return await ctx.buildService.build(options)
    },
    async dev(ctx, options) {
      return await ctx.buildService.build(options)
    },
    close(ctx) {
      ctx.watcherService.closeAll()
    },
    resolvePlatformAlias(input) {
      return resolveMiniProgramPlatform(input)
    },
  },
}
