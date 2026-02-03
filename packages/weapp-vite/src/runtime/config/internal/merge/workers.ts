import type { InlineConfig } from 'vite'
import type { MutableCompilerContext } from '../../../../context'
import { defu } from '@weapp-core/shared'
import { vitePluginWeappWorkers } from '../../../../plugins'
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
        build: {
          watch: {},
          minify: false,
          emptyOutDir: false,
        },
      },
    )
    stripRollupOptions(inline)
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
      build: {
        emptyOutDir: false,
      },
    },
  )
  stripRollupOptions(inlineConfig)
  inlineConfig.logLevel = 'info'
  injectBuiltinAliases(inlineConfig)
  return inlineConfig
}
