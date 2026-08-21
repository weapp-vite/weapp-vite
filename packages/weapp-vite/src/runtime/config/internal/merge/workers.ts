import type { InlineConfig } from 'vite'
import type { MutableCompilerContext } from '../../../../context'
import { defu } from '@weapp-core/shared'
import { applyWeappViteHostMeta } from '../../../../pluginHost'
import { vitePluginWeappWorkers } from '../../../../plugins'
import { normalizePreserveModulesRolldownOptions } from '../../../preserveModules'
import { stripRollupOptions } from './inline'

interface MergeWorkersOptions {
  ctx: MutableCompilerContext
  isDev: boolean
  config: InlineConfig
  cwd: string
  injectBuiltinAliases: (config: InlineConfig) => void
  getDefineImportMetaEnv: () => Record<string, any>
  applyRuntimePlatform: (runtime: 'miniprogram' | 'web') => void
}

export function resolveWorkersBuildDefaults(isDev: boolean) {
  return isDev
    ? {
        watch: {},
        minify: false,
        emptyOutDir: false,
      }
    : {
        emptyOutDir: false,
      }
}

export function mergeWorkers(options: MergeWorkersOptions, ...configs: Partial<InlineConfig>[]) {
  const {
    ctx,
    isDev,
    config,
    cwd,
    injectBuiltinAliases,
    getDefineImportMetaEnv,
    applyRuntimePlatform,
  } = options
  const platform = ctx.configService?.platform

  applyRuntimePlatform('miniprogram')

  if (isDev) {
    const inline = defu<InlineConfig, InlineConfig[]>(
      config,
      ...configs,
      {
        root: cwd,
        mode: 'development',
        plugins: [vitePluginWeappWorkers(ctx as any)],
        define: getDefineImportMetaEnv(),
        build: resolveWorkersBuildDefaults(true),
      },
    )
    applyWeappViteHostMeta(inline, 'miniprogram', platform)
    stripRollupOptions(inline)
    normalizePreserveModulesRolldownOptions(ctx.configService!, inline.build?.rolldownOptions as Record<string, unknown> ?? (inline.build!.rolldownOptions = {}))
    injectBuiltinAliases(inline)
    return inline
  }

  const inlineConfig = defu<InlineConfig, InlineConfig[]>(
    config,
    ...configs,
    {
      root: cwd,
      mode: 'production',
      plugins: [vitePluginWeappWorkers(ctx as any)],
      define: getDefineImportMetaEnv(),
      build: resolveWorkersBuildDefaults(false),
    },
  )
  applyWeappViteHostMeta(inlineConfig, 'miniprogram', platform)
  stripRollupOptions(inlineConfig)
  inlineConfig.logLevel = 'info'
  normalizePreserveModulesRolldownOptions(ctx.configService!, inlineConfig.build?.rolldownOptions as Record<string, unknown> ?? (inlineConfig.build!.rolldownOptions = {}))
  injectBuiltinAliases(inlineConfig)
  return inlineConfig
}
