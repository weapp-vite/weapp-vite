import type { MutableCompilerContext } from '../../context'
import type { OutputExtensions } from '../../platforms/types'
import type { ConfigService, LoadConfigOptions, LoadConfigResult } from './types'
import fs from 'node:fs'
import process from 'node:process'
import { defu, removeExtensionDeep } from '@weapp-core/shared'
import { getPackageInfoSync } from 'local-pkg'
import { detect } from 'package-manager-detector/detect'
import path from 'pathe'
import logger, { configureLogger } from '../../logger'
import { resolveMultiPlatformConfig } from '../../multiPlatform'
import { DEFAULT_MP_PLATFORM } from '../../platform'
import { normalizeRelativePath, toPosixPath } from '../../utils/path'
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

  const normalizeComparablePath = (input: string) => {
    const resolved = path.resolve(input)
    try {
      return normalizeRelativePath(fs.realpathSync.native(resolved))
    }
    catch {
      const suffixParts: string[] = []
      let cursor = resolved
      let parent = path.dirname(cursor)

      while (parent !== cursor && !fs.existsSync(cursor)) {
        suffixParts.unshift(path.basename(cursor))
        cursor = parent
        parent = path.dirname(cursor)
      }

      try {
        const normalizedBase = normalizeRelativePath(fs.realpathSync.native(cursor))
        return suffixParts.length > 0
          ? normalizeRelativePath(path.join(normalizedBase, ...suffixParts))
          : normalizedBase
      }
      catch {
        return normalizeRelativePath(resolved)
      }
    }
  }

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
    return toPosixPath(path.basename(absolutePluginRoot))
  }

  const resolveAbsolutePluginOutputRoot = () => {
    const absolutePluginRoot = resolveAbsolutePluginRoot()
    if (!absolutePluginRoot) {
      return undefined
    }
    if (options.pluginOnly) {
      return path.resolve(options.cwd, options.mpDistRoot ?? options.config.build?.outDir ?? '')
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
    if (options.pluginOnly) {
      return ''
    }
    const absoluteOutputRoot = resolveAbsolutePluginOutputRoot()
    if (!absoluteOutputRoot) {
      return undefined
    }
    const outDir = path.resolve(options.cwd, options.mpDistRoot ?? '')
    const relativeToOutDir = path.relative(outDir, absoluteOutputRoot)
    const isInsideOutDir = relativeToOutDir === ''
      || (!relativeToOutDir.startsWith('..') && !path.isAbsolute(relativeToOutDir))
    if (!isInsideOutDir) {
      return resolvePluginSourceBase()
    }
    const normalized = normalizeRelativePath(relativeToOutDir)
    if (!normalized || normalized === '.') {
      return resolvePluginSourceBase()
    }
    return normalized
  }

  const remapPluginRelativePath = (relativePath: string) => {
    const pluginBase = resolvePluginSourceBase()
    if (!pluginBase) {
      return normalizeRelativePath(relativePath)
    }
    const normalizedRelative = normalizeRelativePath(relativePath)
    if (normalizedRelative === pluginBase || normalizedRelative.startsWith(`${pluginBase}/`)) {
      const pluginRelative = normalizedRelative === pluginBase
        ? ''
        : normalizedRelative.slice(pluginBase.length + 1)
      const outputBase = resolvePluginOutputBasePosix() ?? pluginBase
      const mapped = pluginRelative ? `${outputBase}/${pluginRelative}` : outputBase
      return mapped
    }
    return normalizedRelative
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

  function formatConfigDisplayPath(filePath?: string) {
    if (!filePath) {
      return undefined
    }
    const relative = normalizeRelativePath(path.relative(options.cwd, filePath))
    return relative && relative !== '' ? relative : path.basename(filePath)
  }

  async function load(optionsInput?: Partial<LoadConfigOptions>) {
    const defaultCwd = process.cwd()
    const input = defu<LoadConfigOptions, LoadConfigOptions[]>(optionsInput, {
      cwd: defaultCwd,
      isDev: false,
      mode: 'development',
      emitDefaultAutoImportOutputs: true,
    })

    const rawConfig = await loadConfigImpl(input)
    const resolvedConfig = defu<Required<LoadConfigResult>, Partial<LoadConfigResult>[]>(rawConfig, {
      cwd: input.cwd ?? defaultCwd,
      isDev: false,
      emitDefaultAutoImportOutputs: true,
      projectConfig: {},
      config: {},
      packageJson: {},
      platform: 'weapp',
      multiPlatform: resolveMultiPlatformConfig(false),
      configFilePath: undefined,
      currentSubPackageRoot: undefined,
      weappWeb: undefined,
    })

    setOptions(resolvedConfig)
    configureLogger(resolvedConfig.config.weapp?.logger)
    if (resolvedConfig.configMergeInfo?.merged) {
      const weappConfigDisplay = formatConfigDisplayPath(resolvedConfig.configMergeInfo.weappConfigPath) ?? 'weapp-vite.config.ts'
      const viteConfigDisplay = formatConfigDisplayPath(resolvedConfig.configMergeInfo.viteConfigPath) ?? 'vite.config.ts'
      logger.info(`[config] 检测到同时存在 ${weappConfigDisplay} 与 ${viteConfigDisplay}，已合并两份 Vite 配置，优先级：${weappConfigDisplay} > ${viteConfigDisplay}`)
    }
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
    get emitDefaultAutoImportOutputs() {
      return options.emitDefaultAutoImportOutputs
    },
    get mpDistRoot() {
      return options.mpDistRoot
    },
    get outDir() {
      return path.resolve(options.cwd, options.mpDistRoot ?? '')
    },
    get multiPlatform() {
      return options.multiPlatform
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
    get projectConfigPath() {
      return options.projectConfigPath
    },
    get projectPrivateConfigPath() {
      return options.projectPrivateConfigPath
    },
    get srcRoot() {
      return options.srcRoot
    },
    get pluginOnly() {
      return options.pluginOnly === true
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
    get weappLibConfig() {
      return options.weappLib
    },
    get weappLibOutputMap() {
      return options.weappLibOutputMap
    },
    relativeCwd(p: string) {
      return normalizeRelativePath(path.relative(options.cwd, p))
    },
    relativeSrcRoot(p: string) {
      return options.relativeSrcRoot(p)
    },
    relativeAbsoluteSrcRoot(p: string) {
      const absoluteSrcRoot = path.resolve(options.cwd, options.srcRoot)
      const comparableTarget = normalizeComparablePath(p)
      const comparableSrcRoot = normalizeComparablePath(absoluteSrcRoot)
      const absolutePluginRoot = resolveAbsolutePluginRoot()
      if (absolutePluginRoot) {
        const relativeToPlugin = normalizeRelativePath(path.relative(normalizeComparablePath(absolutePluginRoot), comparableTarget))
        if (!relativeToPlugin.startsWith('..')) {
          if (options.pluginOnly) {
            return relativeToPlugin
          }
          const pluginBase = path.basename(absolutePluginRoot)
          const posixBase = toPosixPath(pluginBase)
          return relativeToPlugin ? `${posixBase}/${relativeToPlugin}` : posixBase
        }
      }

      const relativeFromSrc = normalizeRelativePath(path.relative(comparableSrcRoot, comparableTarget))
      if (!relativeFromSrc.startsWith('..')) {
        return relativeFromSrc
      }

      const relativeFromCwd = normalizeRelativePath(path.relative(normalizeComparablePath(options.cwd), comparableTarget))
      return relativeFromCwd
    },
    relativeOutputPath(p: string) {
      const relative = this.relativeAbsoluteSrcRoot(p)
      if (!relative) {
        return relative
      }
      const libOutputMap = options.weappLibOutputMap
      if (libOutputMap && libOutputMap.size > 0) {
        const base = normalizeRelativePath(removeExtensionDeep(relative))
        const mapped = libOutputMap.get(base)
        if (mapped) {
          const ext = path.extname(relative)
          const fileName = ext ? `${mapped}${ext}` : mapped
          return remapPluginRelativePath(fileName)
        }
      }
      return remapPluginRelativePath(relative)
    },
  }
}

export { createConfigService }
