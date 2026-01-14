import type { InlineConfig } from 'vite'
import type { MutableCompilerContext } from '../../../../context'
import { defu } from '@weapp-core/shared'
import { vitePluginWeappWorkers } from '../../../../plugins'

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
  inlineConfig.logLevel = 'info'
  injectBuiltinAliases(inlineConfig)
  return inlineConfig
}
