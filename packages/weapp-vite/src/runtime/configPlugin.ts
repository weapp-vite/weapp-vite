import type { DetectResult } from 'package-manager-detector'
import type { PackageJson } from 'pkg-types'
import type { RolldownOptions, RolldownPluginOption } from 'rolldown'
import type { InlineConfig, Plugin, PluginOption } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { OutputExtensions } from '../platforms/types'
import type { SubPackageMetaValue } from '../types'
import type { MigrateEnhanceOptionsConfig } from './config/enhance'
import type { ConfigService, LoadConfigOptions, LoadConfigResult } from './config/types'
import process from 'node:process'
import { defu } from '@weapp-core/shared'
import { weappWebPlugin } from '@weapp-vite/web'
import fs from 'fs-extra'
import { getPackageInfoSync } from 'local-pkg'
import { detect } from 'package-manager-detector/detect'
import path from 'pathe'
import { loadConfigFromFile } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defaultExcluded, getOutputExtensions, getWeappViteConfig } from '../defaults'
import { DEFAULT_MP_PLATFORM } from '../platform'
import { vitePluginWeapp, vitePluginWeappWorkers } from '../plugins'
import { getAliasEntries, getProjectConfig, resolveWeappConfigFile } from '../utils'
import { hasDeprecatedEnhanceUsage, migrateEnhanceOptions } from './config/enhance'
import { createLegacyEs5Plugin } from './config/legacyEs5'
import { sanitizeBuildTarget } from './config/targets'
import { resolveWeappWebConfig } from './config/web'
import { createOxcRuntimeSupport } from './oxcRuntime'
import { resolveBuiltinPackageAliases } from './packageAliases'

function createConfigService(ctx: MutableCompilerContext): ConfigService {
  const configState = ctx.runtimeState.config
  configState.packageInfo = getPackageInfoSync('weapp-vite')!
  const defineEnv = configState.defineEnv
  let packageManager: DetectResult = configState.packageManager
  let options: LoadConfigResult = configState.options
  const builtinPackageAliases = resolveBuiltinPackageAliases()
  const oxcRuntimeSupport = createOxcRuntimeSupport()

  interface AliasEntry { find: string | RegExp, replacement: string }
  type AliasOptions = NonNullable<NonNullable<InlineConfig['resolve']>['alias']>

  function normalizeAliasOptions(alias?: AliasOptions | null): AliasEntry[] {
    if (!alias) {
      return []
    }
    if (Array.isArray(alias)) {
      return alias.filter((entry): entry is AliasEntry => {
        return Boolean(entry && typeof entry === 'object' && 'find' in entry && 'replacement' in entry)
      })
    }
    return Object.entries(alias as Record<string, string>).map(([find, replacement]) => {
      return { find, replacement }
    })
  }

  function injectBuiltinAliases(config: InlineConfig) {
    const resolve = config.resolve ?? (config.resolve = {})
    const aliasEntry: AliasEntry & { find: RegExp } = oxcRuntimeSupport.alias
    const aliasArray = normalizeAliasOptions(resolve.alias)

    const hasAlias = aliasArray.some((entry) => {
      return entry.find instanceof RegExp && entry.find.source === aliasEntry.find.source
    })
    if (!hasAlias) {
      aliasArray.unshift(aliasEntry)
    }

    for (const builtinAlias of builtinPackageAliases) {
      const hasAliasEntry = aliasArray.some(entry => typeof entry.find === 'string' && entry.find === builtinAlias.find)
      if (!hasAliasEntry) {
        aliasArray.unshift(builtinAlias)
      }
    }

    resolve.alias = aliasArray
  }
  function getDefineImportMetaEnv() {
    const mpPlatform = options?.platform ?? DEFAULT_MP_PLATFORM
    const resolvedPlatform = defineEnv.PLATFORM ?? mpPlatform
    const env = {
      PLATFORM: resolvedPlatform,
      MP_PLATFORM: resolvedPlatform,
      ...defineEnv,
    }
    const define: Record<string, any> = {}
    for (const [key, value] of Object.entries(env)) {
      define[`import.meta.env.${key}`] = JSON.stringify(value)
    }

    define['import.meta.env'] = JSON.stringify(env)
    return define
  }

  function setDefineEnv(key: string, value: any) {
    defineEnv[key] = value
  }

  function applyRuntimePlatform(runtime: 'miniprogram' | 'web') {
    const isWeb = runtime === 'web'
    const mpPlatform = options?.platform ?? DEFAULT_MP_PLATFORM
    const resolvedPlatform = isWeb ? 'web' : mpPlatform
    setDefineEnv('PLATFORM', resolvedPlatform)
    setDefineEnv('IS_WEB', isWeb)
    setDefineEnv('IS_MINIPROGRAM', !isWeb)
  }

  applyRuntimePlatform('miniprogram')

  async function loadConfig(opts: LoadConfigOptions) {
    const { cwd, isDev, mode, inlineConfig, configFile } = opts
    const projectConfig = await getProjectConfig(cwd)
    const mpDistRoot = projectConfig.miniprogramRoot ?? projectConfig.srcMiniprogramRoot
    if (!mpDistRoot) {
      throw new Error('请在 `project.config.json` 里设置 `miniprogramRoot`, 比如可以设置为 `dist/` ')
    }
    const packageJsonPath = path.resolve(cwd, 'package.json')

    let packageJson: PackageJson = {}
    if (await fs.exists(packageJsonPath)) {
      const localPackageJson: PackageJson = await fs.readJson(packageJsonPath, {
        throws: false,
      }) || {}
      packageJson = localPackageJson
    }

    let resolvedConfigFile = configFile
    if (resolvedConfigFile && !path.isAbsolute(resolvedConfigFile)) {
      resolvedConfigFile = path.resolve(cwd, resolvedConfigFile)
    }

    const weappConfigFilePath = await resolveWeappConfigFile({
      root: cwd,
      specified: resolvedConfigFile,
    })

    const loaded = await loadConfigFromFile({
      command: isDev ? 'serve' : 'build',
      mode,
    }, resolvedConfigFile, cwd)

    const loadedConfig = loaded?.config

    let weappLoaded: Awaited<ReturnType<typeof loadConfigFromFile>> | undefined
    if (weappConfigFilePath) {
      const normalizedWeappPath = path.resolve(weappConfigFilePath)
      const normalizedLoadedPath = loaded?.path ? path.resolve(loaded.path) : undefined
      if (normalizedLoadedPath && normalizedLoadedPath === normalizedWeappPath) {
        weappLoaded = loaded
      }
      else {
        weappLoaded = await loadConfigFromFile({
          command: isDev ? 'serve' : 'build',
          mode,
        }, weappConfigFilePath, cwd)
      }
    }

    const config = defu<InlineConfig, (InlineConfig | undefined)[]>(
      inlineConfig,
      {
        mode,
        configFile: false,
      },
      loadedConfig,
      {
        build: {
          rolldownOptions: {
            output: {
              entryFileNames: (chunkInfo) => {
                return `${chunkInfo.name}.js`
              },
              hashCharacters: 'base36',
            },
          },
          assetsDir: '.',
        },
        logLevel: 'warn',
        weapp: getWeappViteConfig(),
      },
    )
    if (weappLoaded?.config?.weapp) {
      config.weapp = defu(
        weappLoaded.config.weapp,
        config.weapp ?? {},
      )
    }

    const shouldWarnEnhance = [
      inlineConfig?.weapp?.enhance,
      loadedConfig?.weapp?.enhance,
      weappLoaded?.config?.weapp?.enhance,
    ].some(hasDeprecatedEnhanceUsage)

    const userConfiguredTopLevel: MigrateEnhanceOptionsConfig = {
      wxml: [
        inlineConfig?.weapp?.wxml,
        loadedConfig?.weapp?.wxml,
        weappLoaded?.config?.weapp?.wxml,
      ].some(value => value !== undefined),
      wxs: [
        inlineConfig?.weapp?.wxs,
        loadedConfig?.weapp?.wxs,
        weappLoaded?.config?.weapp?.wxs,
      ].some(value => value !== undefined),
      autoImportComponents: [
        inlineConfig?.weapp?.autoImportComponents,
        loadedConfig?.weapp?.autoImportComponents,
        weappLoaded?.config?.weapp?.autoImportComponents,
      ].some(value => value !== undefined),
    }

    migrateEnhanceOptions(config.weapp, {
      warn: shouldWarnEnhance,
      userConfigured: userConfiguredTopLevel,
    })

    const srcRoot = config.weapp?.srcRoot ?? ''
    const resolvedWebConfig = resolveWeappWebConfig({
      cwd,
      srcRoot,
      config: config.weapp?.web,
    })

    const buildConfig = config.build ?? (config.build = {})
    const jsFormat = config.weapp?.jsFormat ?? 'cjs'
    const enableLegacyEs5 = config.weapp?.es5 === true

    if (enableLegacyEs5 && jsFormat !== 'cjs') {
      throw new Error('`weapp.es5` 仅支持在 `weapp.jsFormat` 为 "cjs" 时使用，请切换到 CommonJS 或关闭该选项。')
    }

    const targetInfo = sanitizeBuildTarget(buildConfig.target, { allowEs5: enableLegacyEs5 })
    if (enableLegacyEs5) {
      buildConfig.target = 'es2015'
    }
    else if (targetInfo.hasTarget && targetInfo.sanitized !== undefined) {
      buildConfig.target = targetInfo.sanitized
    }

    const rdOptions = buildConfig.rolldownOptions ?? (buildConfig.rolldownOptions = {})
    if (Array.isArray(rdOptions.output)) {
      rdOptions.output = rdOptions.output.map((output) => {
        return {
          ...output,
          format: jsFormat,
        }
      })
    }
    else {
      const output = rdOptions.output ?? (rdOptions.output = {})
      output.format = jsFormat
    }

    const rawPlugins = rdOptions.plugins
    const pluginArray: RolldownPluginOption<any>[] = rawPlugins == null
      ? []
      : Array.isArray(rawPlugins)
        ? [...rawPlugins]
        : [rawPlugins]

    if (enableLegacyEs5) {
      const swcPluginName = 'weapp-runtime:swc-es5-transform'
      const hasSwcPlugin = pluginArray.some(plugin => plugin
        // @ts-ignore
        ?.name === swcPluginName)
      if (!hasSwcPlugin) {
        pluginArray.push(createLegacyEs5Plugin())
      }
    }

    if (pluginArray.length > 0) {
      rdOptions.plugins = pluginArray
    }

    function relativeSrcRoot(p: string) {
      if (srcRoot) {
        return path.relative(srcRoot, p)
      }
      return p
    }

    const rolldownPlugin = oxcRuntimeSupport.rolldownPlugin
    if (rolldownPlugin) {
      const build = config.build ?? (config.build = {})
      const rdOptions = build.rolldownOptions ?? (build.rolldownOptions = {})
      const rawPlugins = rdOptions.plugins
      const pluginArray: RolldownPluginOption<any>[] = rawPlugins == null
        ? []
        : Array.isArray(rawPlugins)
          ? [...rawPlugins]
          : [rawPlugins]

      const hasPlugin = pluginArray.includes(rolldownPlugin)

      if (!hasPlugin) {
        rdOptions.plugins = [rolldownPlugin, ...pluginArray]
      }
      else if (!Array.isArray(rawPlugins)) {
        rdOptions.plugins = pluginArray
      }
    }
    injectBuiltinAliases(config)
    if (oxcRuntimeSupport.vitePlugin) {
      config.plugins ??= []
      config.plugins.unshift(oxcRuntimeSupport.vitePlugin)
    }
    const platform = config.weapp?.platform ?? 'weapp'

    const resolvedOutputExtensions = getOutputExtensions(platform)
    config.plugins ??= []
    config.plugins?.push(tsconfigPaths(config.weapp?.tsconfigPaths))
    const aliasEntries = getAliasEntries(config.weapp?.jsonAlias)
    const configFilePath = weappLoaded?.path ?? loaded?.path ?? resolvedConfigFile

    return {
      config,
      aliasEntries,
      outputExtensions: resolvedOutputExtensions,
      packageJson,
      relativeSrcRoot,
      cwd,
      isDev,
      mode,
      projectConfig,
      mpDistRoot,
      packageJsonPath,
      platform,
      srcRoot,
      configFilePath,
      currentSubPackageRoot: undefined,
      weappWeb: resolvedWebConfig,
    }
  }

  async function load(optionsInput?: Partial<LoadConfigOptions>) {
    const defaultCwd = process.cwd()
    const input = defu<LoadConfigOptions, LoadConfigOptions[]>(optionsInput, {
      cwd: defaultCwd,
      isDev: false,
      mode: 'development',
    })
    const rawConfig = await loadConfig(input)

    const resolvedConfig = defu<Required<LoadConfigResult>, Partial<LoadConfigResult>[]>(rawConfig, {
      cwd: input.cwd ?? defaultCwd,
      isDev: false,
      projectConfig: {},
      config: {},
      packageJson: {},
      platform: 'weapp',
      configFilePath: undefined,
      currentSubPackageRoot: undefined,
      weappWeb: undefined,
    })

    options = resolvedConfig
    configState.options = resolvedConfig
    packageManager = (await detect()) ?? {
      agent: 'npm',
      name: 'npm',
    }
    configState.packageManager = packageManager

    return resolvedConfig
  }

  function mergeWorkers(...configs: Partial<InlineConfig>[]) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before merging workers config')
    }
    options = configState.options
    applyRuntimePlatform('miniprogram')

    if (options.isDev) {
      const inline = defu<InlineConfig, InlineConfig[]>(
        options.config,
        ...configs,
        {
          root: options.cwd,
          mode: 'development',
          plugins: [vitePluginWeappWorkers(ctx as any)],
          define: getDefineImportMetaEnv(),
          build: {
            watch: {
              // TODO: expose options
            },
            minify: false,
            emptyOutDir: false,
          },
        },
      )
      injectBuiltinAliases(inline)
      return inline
    }

    const inlineConfig = defu<InlineConfig, InlineConfig[]>(
      options.config,
      ...configs,
      {
        root: options.cwd,
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

  function merge(subPackageMeta?: SubPackageMetaValue, ...configs: Partial<InlineConfig | undefined>[]) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before merging config')
    }
    options = configState.options
    applyRuntimePlatform('miniprogram')
    const external: (string | RegExp)[] = []
    if (options.packageJson.dependencies) {
      external.push(...Object.keys(options.packageJson.dependencies).map((pkg) => {
        return new RegExp(`^${pkg.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\/|$)`)
      }))
    }
    const rolldownPlugin = oxcRuntimeSupport.rolldownPlugin
    const rolldownOptions: RolldownOptions = {
      external,
      plugins: rolldownPlugin ? [rolldownPlugin] : undefined,
    }
    if (options.isDev) {
      const inline = defu<InlineConfig, (InlineConfig | undefined)[]>(
        options.config,
        ...configs,
        {
          root: options.cwd,
          mode: 'development',
          plugins: [vitePluginWeapp(ctx as any, subPackageMeta)],
          define: getDefineImportMetaEnv(),
          build: {
            watch: {
              exclude: [
                ...defaultExcluded,
                options.mpDistRoot
                  ? path.join(options.cwd, options.mpDistRoot, '**')
                  : path.join(options.cwd, 'dist', '**'),
              ],
              include: [path.join(options.cwd, options.srcRoot, '**')],
            },
            minify: false,
            emptyOutDir: false,
            // @ts-ignore
            rolldownOptions: {
              ...rolldownOptions,
            },
            sourcemap: true,
          },
        },
      )
      injectBuiltinAliases(inline)
      return inline
    }

    const inlineConfig = defu<InlineConfig, (InlineConfig | undefined)[]>(
      options.config,
      ...configs,
      {
        root: options.cwd,
        plugins: [
          vitePluginWeapp(
            ctx as any,
            subPackageMeta,
          ),
        ],
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
    inlineConfig.logLevel = 'info'
    injectBuiltinAliases(inlineConfig)
    const currentRoot = subPackageMeta?.subPackage.root
    options = {
      ...options,
      currentSubPackageRoot: currentRoot,
    }
    configState.options = options
    return inlineConfig
  }

  function mergeWeb(...configs: Partial<InlineConfig | undefined>[]) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before merging web config')
    }
    options = configState.options
    const web = options.weappWeb
    if (!web?.enabled) {
      return undefined
    }
    applyRuntimePlatform('web')

    const inline = defu<InlineConfig, (InlineConfig | undefined)[]>(
      options.config,
      web.userConfig,
      ...configs,
      {
        root: web.root,
        mode: options.mode,
        configFile: false,
        define: getDefineImportMetaEnv(),
        build: {
          outDir: web.outDir,
          emptyOutDir: !options.isDev,
        },
      },
    )

    inline.root = web.root
    inline.configFile = false
    inline.mode = inline.mode ?? options.mode

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
      rawPlugins.forEach(option => collect(option))
    }
    else if (rawPlugins) {
      collect(rawPlugins)
    }

    inline.plugins = [webPlugin, ...remaining]

    inline.build ??= {}
    if (inline.build.outDir == null) {
      inline.build.outDir = web.outDir
    }
    if (inline.build.emptyOutDir == null) {
      inline.build.emptyOutDir = !options.isDev
    }

    inline.define = defu(inline.define ?? {}, getDefineImportMetaEnv())
    injectBuiltinAliases(inline)
    return inline
  }

  return {
    get options() {
      return options
    },
    set options(value: LoadConfigResult) {
      options = value
      configState.options = value
    },
    get outputExtensions() {
      return options.outputExtensions
    },
    set outputExtensions(value: OutputExtensions) {
      options = {
        ...options,
        outputExtensions: value,
      }
      configState.options = options
    },
    defineEnv,
    get packageManager() {
      return configState.packageManager
    },
    get packageInfo() {
      return configState.packageInfo
    },
    setDefineEnv,
    load,
    mergeWorkers,
    merge,
    mergeWeb,
    get defineImportMetaEnv() {
      return getDefineImportMetaEnv()
    },
    get cwd() {
      return options.cwd
    },
    get isDev() {
      return options.isDev
    },
    get mpDistRoot() {
      return options.mpDistRoot
    },
    get outDir() {
      return path.resolve(options.cwd, options.mpDistRoot ?? '')
    },
    get currentSubPackageRoot() {
      return options.currentSubPackageRoot
    },
    get inlineConfig() {
      return options.config
    },
    get weappViteConfig() {
      return options.config.weapp!
    },
    get packageJson() {
      return options.packageJson
    },
    get projectConfig() {
      return options.projectConfig
    },
    get srcRoot() {
      return options.srcRoot
    },
    get pluginRoot() {
      return options.config.weapp?.pluginRoot
    },
    get absolutePluginRoot() {
      if (options.config.weapp?.pluginRoot) {
        return path.resolve(options.cwd, options.config.weapp.pluginRoot)
      }
    },
    get absoluteSrcRoot() {
      return path.resolve(options.cwd, options.srcRoot)
    },
    get mode() {
      return options.mode
    },
    get aliasEntries() {
      return options.aliasEntries
    },
    get platform() {
      return options.platform
    },
    get configFilePath() {
      return options.configFilePath
    },
    get weappWebConfig() {
      return options.weappWeb
    },
    relativeCwd(p: string) {
      return path.relative(options.cwd, p)
    },
    relativeSrcRoot(p: string) {
      return options.relativeSrcRoot(p)
    },
    relativeAbsoluteSrcRoot(p: string) {
      return path.relative(path.resolve(options.cwd, options.srcRoot), p)
    },
  }
}

export function createConfigServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createConfigService(ctx)
  ctx.configService = service

  return {
    name: 'weapp-runtime:config-service',
  }
}
