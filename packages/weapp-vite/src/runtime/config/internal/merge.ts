import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig, PluginOption } from 'vite'
import type { MutableCompilerContext } from '../../../context'
import type { SubPackageMetaValue } from '../../../types'
import type { LoadConfigResult } from '../types'
import { defu } from '@weapp-core/shared'
import { weappWebPlugin } from '@weapp-vite/web'
import path from 'pathe'
import { defaultExcluded } from '../../../defaults'
import { vitePluginWeapp, vitePluginWeappWorkers, WEAPP_VITE_CONTEXT_PLUGIN_NAME } from '../../../plugins'
import { requireConfigService } from '../../utils/requireConfigService'

export interface MergeFactoryOptions {
  ctx: MutableCompilerContext
  getOptions: () => LoadConfigResult
  setOptions: (value: LoadConfigResult) => void
  injectBuiltinAliases: (config: InlineConfig) => void
  getDefineImportMetaEnv: () => Record<string, any>
  applyRuntimePlatform: (runtime: 'miniprogram' | 'web') => void
  oxcRolldownPlugin: RolldownPluginOption<any> | undefined
}

export interface MergeFactoryResult {
  mergeWorkers: (...configs: Partial<InlineConfig>[]) => InlineConfig
  merge: (subPackageMeta: SubPackageMetaValue | undefined, ...configs: Partial<InlineConfig | undefined>[]) => InlineConfig
  mergeWeb: (...configs: Partial<InlineConfig | undefined>[]) => InlineConfig | undefined
  mergeInlineConfig: (...configs: Partial<InlineConfig>[]) => InlineConfig
}

export function createMergeFactories(options: MergeFactoryOptions): MergeFactoryResult {
  const {
    ctx,
    getOptions,
    setOptions,
    injectBuiltinAliases,
    getDefineImportMetaEnv,
    applyRuntimePlatform,
    oxcRolldownPlugin,
  } = options

  function ensureConfigService() {
    requireConfigService(ctx, 'configService must be initialized before merging config')
  }

  function mergeWorkers(...configs: Partial<InlineConfig>[]) {
    ensureConfigService()
    const currentOptions = getOptions()
    applyRuntimePlatform('miniprogram')

    if (currentOptions.isDev) {
      const inline = defu<InlineConfig, InlineConfig[]>(
        currentOptions.config,
        ...configs,
        {
          root: currentOptions.cwd,
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
      currentOptions.config,
      ...configs,
      {
        root: currentOptions.cwd,
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

  function normalizePluginOptions(option: PluginOption | PluginOption[] | undefined): PluginOption[] {
    const normalized: PluginOption[] = []
    if (!option) {
      return normalized
    }
    if (Array.isArray(option)) {
      for (const entry of option) {
        normalized.push(...normalizePluginOptions(entry))
      }
      return normalized
    }
    normalized.push(option)
    return normalized
  }

  function isNamedPlugin(option: PluginOption, name: string): option is Exclude<PluginOption, null | boolean | undefined> & { name: string } {
    return typeof option === 'object' && option !== null && 'name' in option && option.name === name
  }

  function arrangePlugins(config: InlineConfig, subPackageMeta: SubPackageMetaValue | undefined) {
    const existing = normalizePluginOptions(config.plugins)
    const tsconfigPlugins: PluginOption[] = []
    const others: PluginOption[] = []

    for (const entry of existing) {
      if (!entry) {
        continue
      }
      if (isNamedPlugin(entry, 'vite-tsconfig-paths')) {
        tsconfigPlugins.push(entry)
        continue
      }
      if (isNamedPlugin(entry, WEAPP_VITE_CONTEXT_PLUGIN_NAME)) {
        continue
      }
      others.push(entry)
    }

    config.plugins = [
      vitePluginWeapp(ctx as any, subPackageMeta),
      ...others,
      ...tsconfigPlugins,
    ]
  }

  function merge(subPackageMeta: SubPackageMetaValue | undefined, ...configs: Partial<InlineConfig | undefined>[]) {
    ensureConfigService()
    const currentOptions = getOptions()
    applyRuntimePlatform('miniprogram')

    const external: (string | RegExp)[] = []
    if (currentOptions.packageJson?.dependencies) {
      external.push(
        ...Object.keys(currentOptions.packageJson.dependencies).map((pkg) => {
          return new RegExp(`^${pkg.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\/|$)`)
        }),
      )
    }

    const rolldownOptions = {
      external,
      plugins: oxcRolldownPlugin ? [oxcRolldownPlugin] : undefined,
    }

    if (currentOptions.isDev) {
      const watchInclude: string[] = [
        path.join(currentOptions.cwd, currentOptions.srcRoot, '**'),
      ]
      const pluginRootConfig = currentOptions.config.weapp?.pluginRoot
      if (pluginRootConfig) {
        const absolutePluginRoot = path.resolve(currentOptions.cwd, pluginRootConfig)
        const relativeToSrc = path.relative(
          path.resolve(currentOptions.cwd, currentOptions.srcRoot),
          absolutePluginRoot,
        )
        const pluginPatternBase = relativeToSrc.startsWith('..')
          ? absolutePluginRoot
          : path.join(currentOptions.cwd, currentOptions.srcRoot, relativeToSrc)
        watchInclude.push(path.join(pluginPatternBase, '**'))
      }

      const inline = defu<InlineConfig, (InlineConfig | undefined)[]>(
        currentOptions.config,
        ...configs,
        {
          root: currentOptions.cwd,
          mode: 'development',
          define: getDefineImportMetaEnv(),
          build: {
            watch: {
              exclude: [
                ...defaultExcluded,
                currentOptions.mpDistRoot
                  ? path.join(currentOptions.cwd, currentOptions.mpDistRoot, '**')
                  : path.join(currentOptions.cwd, 'dist', '**'),
              ],
              include: watchInclude,
            },
            minify: false,
            emptyOutDir: false,
            // @ts-ignore
            rolldownOptions: {
              ...rolldownOptions,
            },
            sourcemap: false,
          },
        },
      )
      arrangePlugins(inline, subPackageMeta)
      injectBuiltinAliases(inline)
      return inline
    }

    const inlineConfig = defu<InlineConfig, (InlineConfig | undefined)[]>(
      currentOptions.config,
      ...configs,
      {
        root: currentOptions.cwd,
        mode: 'production',
        define: getDefineImportMetaEnv(),
        build: {
          emptyOutDir: false,
          // @ts-ignore
          rolldownOptions: {
            ...rolldownOptions,
          },
        },
      },
    )
    arrangePlugins(inlineConfig, subPackageMeta)
    inlineConfig.logLevel = 'info'
    injectBuiltinAliases(inlineConfig)

    const currentRoot = subPackageMeta?.subPackage.root
    setOptions({
      ...currentOptions,
      currentSubPackageRoot: currentRoot,
    })

    return inlineConfig
  }

  function mergeWeb(...configs: Partial<InlineConfig | undefined>[]) {
    ensureConfigService()
    const currentOptions = getOptions()
    const web = currentOptions.weappWeb
    if (!web?.enabled) {
      return undefined
    }

    applyRuntimePlatform('web')

    const inline = defu<InlineConfig, (InlineConfig | undefined)[]>(
      currentOptions.config,
      web.userConfig,
      ...configs,
      {
        root: web.root,
        mode: currentOptions.mode,
        configFile: false,
        define: getDefineImportMetaEnv(),
        build: {
          outDir: web.outDir,
          emptyOutDir: !currentOptions.isDev,
        },
      },
    )

    inline.root = web.root
    inline.configFile = false
    inline.mode = inline.mode ?? currentOptions.mode

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
      inline.build.emptyOutDir = !currentOptions.isDev
    }

    inline.define = defu(inline.define ?? {}, getDefineImportMetaEnv())
    injectBuiltinAliases(inline)

    return inline
  }

  function mergeInlineConfig(...configs: Partial<InlineConfig>[]) {
    const currentOptions = getOptions()
    const merged = defu<InlineConfig, InlineConfig[]>(
      currentOptions.config,
      ...configs,
    )
    injectBuiltinAliases(merged)
    return merged
  }

  return {
    mergeWorkers,
    merge,
    mergeWeb,
    mergeInlineConfig,
  }
}
