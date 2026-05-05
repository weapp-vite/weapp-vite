import type { InlineConfig, PluginOption } from 'vite'
import type { ResolvedWeappWebConfig } from '../../types'
import { defu } from '@weapp-core/shared'
import { weappWebPlugin } from '@weapp-vite/web'
import { applyWeappViteHostMeta } from '../../../../pluginHost'
import { stripRollupOptions } from './inline'

interface MergeWebOptions {
  config: InlineConfig
  web: ResolvedWeappWebConfig | undefined
  mode: string
  isDev: boolean
  applyRuntimePlatform: (runtime: 'miniprogram' | 'web') => void
  injectBuiltinAliases: (config: InlineConfig) => void
  getDefineImportMetaEnv: () => Record<string, any>
}

export function mergeWebPlugins(
  rawPlugins: InlineConfig['plugins'],
  webPlugin: PluginOption,
) {
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
      && option.name === (webPlugin as { name?: string }).name) {
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

  return [webPlugin as any, ...remaining] as InlineConfig['plugins']
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
  stripRollupOptions(inline)

  inline.root = web.root
  inline.configFile = false
  inline.mode = inline.mode ?? mode

  const webPlugin = weappWebPlugin(web.pluginOptions)
  inline.plugins = mergeWebPlugins(inline.plugins, webPlugin)

  inline.build ??= {}
  inline.build.outDir = web.outDir
  inline.build.emptyOutDir ??= !isDev

  applyWeappViteHostMeta(inline, 'web', 'web')
  inline.define = defu(inline.define ?? {}, getDefineImportMetaEnv())
  injectBuiltinAliases(inline)

  return inline
}
