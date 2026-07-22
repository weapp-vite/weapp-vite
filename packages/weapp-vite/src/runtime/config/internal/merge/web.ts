import type { InlineConfig, PluginOption } from 'vite'
import type { ResolvedWeappWebConfig } from '../../types'
import { WEAPP_VITE_RUNTIME_VIRTUAL_ID } from '@weapp-core/constants'
import { defu } from '@weapp-core/shared'
import { weappWebPlugin } from '@weapp-vite/web'
import { applyWeappViteHostMeta } from '../../../../pluginHost'
import {
  createSelectedRuntimeProviderPlugin,
  resolveRuntimeProvider,
  resolveRuntimeProviderHmrFooter,
} from '../../../../runtimeProviders'
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
  runtimeProviderPlugin?: PluginOption,
) {
  const remaining: PluginOption[] = []
  const ownedPluginNames = new Set(
    [webPlugin, runtimeProviderPlugin]
      .map(option => option && typeof option === 'object' && 'name' in option ? option.name : undefined)
      .filter((name): name is string => typeof name === 'string'),
  )
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
      && typeof option.name === 'string'
      && ownedPluginNames.has(option.name)) {
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

  return [runtimeProviderPlugin, webPlugin, ...remaining].filter(Boolean) as InlineConfig['plugins']
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

  const runtimeProvider = resolveRuntimeProvider('web', 'web')
  const runtimeProviderPlugin = createSelectedRuntimeProviderPlugin(runtimeProvider, isDev)
  const webPlugin = weappWebPlugin({
    ...web.pluginOptions,
    __runtimeProvider: {
      moduleId: WEAPP_VITE_RUNTIME_VIRTUAL_ID,
      hmrAcceptCode: resolveRuntimeProviderHmrFooter(runtimeProvider),
    },
  })
  inline.plugins = mergeWebPlugins(inline.plugins, webPlugin, runtimeProviderPlugin)

  inline.build ??= {}
  inline.build.outDir = web.outDir
  inline.build.emptyOutDir ??= !isDev

  applyWeappViteHostMeta(inline, 'web', 'web')
  inline.define = defu(inline.define ?? {}, getDefineImportMetaEnv())
  injectBuiltinAliases(inline)

  return inline
}
