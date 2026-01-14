import type { InlineConfig, PluginOption } from 'vite'
import { defu } from '@weapp-core/shared'
import { weappWebPlugin } from '@weapp-vite/web'

interface MergeWebOptions {
  config: InlineConfig
  web: NonNullable<InlineConfig['weappWeb']> | undefined
  mode: string
  isDev: boolean
  applyRuntimePlatform: (runtime: 'miniprogram' | 'web') => void
  injectBuiltinAliases: (config: InlineConfig) => void
  getDefineImportMetaEnv: () => Record<string, any>
}

export function mergeWeb(options: MergeWebOptions, ...configs: Partial<InlineConfig | undefined>[]) {
  const {
    config,
    mode,
    isDev,
    applyRuntimePlatform,
    injectBuiltinAliases,
    getDefineImportMetaEnv,
  } = options

  const web = options.web
  if (!web?.enabled) {
    return undefined
  }

  applyRuntimePlatform('web')

  const inline = defu<InlineConfig, (InlineConfig | undefined)[]>(
    config,
    web.userConfig,
    ...configs,
    {
      root: web.root,
      mode,
      configFile: false,
      define: getDefineImportMetaEnv(),
      build: {
        outDir: web.outDir,
        emptyOutDir: !isDev,
      },
    },
  )

  inline.root = web.root
  inline.configFile = false
  inline.mode = inline.mode ?? mode

  const webPlugin = weappWebPlugin(web.pluginOptions)
  const rawPlugins = inline.plugins
  const remaining: PluginOption[] = []
  const collect = (option: PluginOption | undefined) => {
    if (!option) {
      return
    }
    if (Array.isArray(option)) {
      option.forEach(item => collect(item))
      return
    }
    if (typeof option === 'object'
      && option !== null
      && 'name' in option
      && option.name === webPlugin.name) {
      return
    }
    remaining.push(option)
  }
  if (Array.isArray(rawPlugins)) {
    rawPlugins.forEach(entry => collect(entry))
  }
  else if (rawPlugins) {
    collect(rawPlugins)
  }
  const mergedPlugins = [webPlugin as any, ...remaining]
  inline.plugins = mergedPlugins as InlineConfig['plugins']

  inline.build ??= {}
  if (inline.build.outDir == null) {
    inline.build.outDir = web.outDir
  }
  if (inline.build.emptyOutDir == null) {
    inline.build.emptyOutDir = !isDev
  }

  inline.define = defu(inline.define ?? {}, getDefineImportMetaEnv())
  injectBuiltinAliases(inline)

  return inline
}
