import type { MutableCompilerContext } from '../../context'
import type { OutputExtensions } from '../../platforms/types'
import type { ConfigService, LoadConfigOptions, LoadConfigResult } from './types'
import process from 'node:process'
import { defu } from '@weapp-core/shared'
import { getPackageInfoSync } from 'local-pkg'
import { detect } from 'package-manager-detector/detect'
import path from 'pathe'
import { DEFAULT_MP_PLATFORM } from '../../platform'
import { createOxcRuntimeSupport } from '../oxcRuntime'
import { resolveBuiltinPackageAliases } from '../packageAliases'
import { createAliasManager } from './internal/alias'
import { createLoadConfig } from './internal/loadConfig'
import { createMergeFactories } from './internal/merge'

function createConfigService(ctx: MutableCompilerContext): ConfigService {
  const configState = ctx.runtimeState.config
  configState.packageInfo = getPackageInfoSync('weapp-vite')!

  const defineEnv = configState.defineEnv
  let packageManager = configState.packageManager
  let options = configState.options

  const builtinAliases = resolveBuiltinPackageAliases()
  const oxcRuntimeSupport = createOxcRuntimeSupport()
  const aliasManager = createAliasManager(oxcRuntimeSupport.alias, builtinAliases)

  const toPosix = (value: string) => value.replace(/\\/g, '/')
  const fromPosix = (value: string) => path.sep === '/' ? value : value.split('/').join(path.sep)

  const resolveAbsolutePluginRoot = () => {
    const pluginRootConfig = options.config.weapp?.pluginRoot
    if (!pluginRootConfig) {
      return undefined
    }
    return path.resolve(options.cwd, pluginRootConfig)
  }

  const resolvePluginSourceBase = () => {
    const absolutePluginRoot = resolveAbsolutePluginRoot()
    if (!absolutePluginRoot) {
      return undefined
    }
    return toPosix(path.basename(absolutePluginRoot))
  }

  const resolveAbsolutePluginOutputRoot = () => {
    const absolutePluginRoot = resolveAbsolutePluginRoot()
    if (!absolutePluginRoot) {
      return undefined
    }
    const configured = options.projectConfig?.pluginRoot
    if (configured) {
      return path.resolve(options.cwd, configured)
    }
    const outDir = path.resolve(options.cwd, options.mpDistRoot ?? '')
    const pluginBase = path.basename(absolutePluginRoot)
    return path.resolve(outDir, pluginBase)
  }

  const resolvePluginOutputBasePosix = () => {
    const absoluteOutputRoot = resolveAbsolutePluginOutputRoot()
    if (!absoluteOutputRoot) {
      return undefined
    }
    const outDir = path.resolve(options.cwd, options.mpDistRoot ?? '')
    const relative = path.relative(outDir, absoluteOutputRoot)
    const normalized = toPosix(relative)
    if (!normalized || normalized === '.') {
      return resolvePluginSourceBase()
    }
    return normalized
  }

  const remapPluginRelativePath = (relativePath: string) => {
    const pluginBase = resolvePluginSourceBase()
    if (!pluginBase) {
      return relativePath
    }
    const normalizedRelative = toPosix(relativePath)
    if (normalizedRelative === pluginBase || normalizedRelative.startsWith(`${pluginBase}/`)) {
      const pluginRelative = normalizedRelative === pluginBase
        ? ''
        : normalizedRelative.slice(pluginBase.length + 1)
      const outputBase = resolvePluginOutputBasePosix() ?? pluginBase
      const mapped = pluginRelative ? `${outputBase}/${pluginRelative}` : outputBase
      return fromPosix(mapped)
    }
    return relativePath
  }

  function setOptions(value: LoadConfigResult) {
    options = value
    configState.options = value
  }

  const getOptions = () => options

  function setDefineEnv(key: string, value: any) {
    defineEnv[key] = value
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

  function applyRuntimePlatform(runtime: 'miniprogram' | 'web') {
    const isWeb = runtime === 'web'
    const mpPlatform = options?.platform ?? DEFAULT_MP_PLATFORM
    const resolvedPlatform = isWeb ? 'web' : mpPlatform
    setDefineEnv('PLATFORM', resolvedPlatform)
    setDefineEnv('IS_WEB', isWeb)
    setDefineEnv('IS_MINIPROGRAM', !isWeb)
  }

  applyRuntimePlatform('miniprogram')

  const loadConfigImpl = createLoadConfig({
    injectBuiltinAliases: aliasManager.injectBuiltinAliases,
    oxcRolldownPlugin: oxcRuntimeSupport.rolldownPlugin,
    oxcVitePlugin: oxcRuntimeSupport.vitePlugin,
  })

  async function load(optionsInput?: Partial<LoadConfigOptions>) {
    const defaultCwd = process.cwd()
    const input = defu<LoadConfigOptions, LoadConfigOptions[]>(optionsInput, {
      cwd: defaultCwd,
      isDev: false,
      mode: 'development',
    })

    const rawConfig = await loadConfigImpl(input)
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

    setOptions(resolvedConfig)
    packageManager = (await detect()) ?? {
      agent: 'npm',
      name: 'npm',
    }
    configState.packageManager = packageManager

    return resolvedConfig
  }

  const { mergeWorkers, merge, mergeWeb, mergeInlineConfig } = createMergeFactories({
    ctx,
    getOptions,
    setOptions,
    injectBuiltinAliases: aliasManager.injectBuiltinAliases,
    getDefineImportMetaEnv,
    applyRuntimePlatform,
    oxcRolldownPlugin: oxcRuntimeSupport.rolldownPlugin,
  })

  return {
    get options() {
      return options
    },
    set options(value: LoadConfigResult) {
      setOptions(value)
    },
    get outputExtensions() {
      return options.outputExtensions
    },
    set outputExtensions(value: OutputExtensions) {
      setOptions({
        ...options,
        outputExtensions: value,
      })
    },
    defineEnv,
    get packageManager() {
      return packageManager
    },
    get packageInfo() {
      return configState.packageInfo
    },
    setDefineEnv,
    load,
    mergeWorkers,
    merge,
    mergeWeb,
    mergeInlineConfig,
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
      return resolveAbsolutePluginRoot()
    },
    get absolutePluginOutputRoot() {
      return resolveAbsolutePluginOutputRoot()
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
      const absoluteSrcRoot = path.resolve(options.cwd, options.srcRoot)
      const absolutePluginRoot = resolveAbsolutePluginRoot()
      if (absolutePluginRoot) {
        const relativeToPlugin = path.relative(absolutePluginRoot, p)
        if (!relativeToPlugin.startsWith('..')) {
          const pluginBase = path.basename(absolutePluginRoot)
          return relativeToPlugin ? path.join(pluginBase, relativeToPlugin) : pluginBase
        }
      }

      const relativeFromSrc = path.relative(absoluteSrcRoot, p)
      if (!relativeFromSrc.startsWith('..')) {
        return relativeFromSrc
      }

      const relativeFromCwd = path.relative(options.cwd, p)
      return relativeFromCwd
    },
    relativeOutputPath(p: string) {
      const relative = this.relativeAbsoluteSrcRoot(p)
      if (!relative) {
        return relative
      }
      return remapPluginRelativePath(relative)
    },
  }
}

export { createConfigService }
