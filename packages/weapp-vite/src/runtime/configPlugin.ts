import type { DetectResult } from 'package-manager-detector'
import type { PackageJson } from 'pkg-types'
import type { RolldownOptions, Plugin as RolldownPlugin, RolldownPluginOption } from 'rolldown'
import type { InlineConfig, Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { OutputExtensions } from '../defaults'
import type { SubPackageMetaValue } from '../types'
import type { ConfigService, LoadConfigOptions, LoadConfigResult } from './config/types'
import process from 'node:process'
import { defu } from '@weapp-core/shared'
import fs from 'fs-extra'
import { getPackageInfoSync } from 'local-pkg'
import { detect } from 'package-manager-detector/detect'
import path from 'pathe'
import { loadConfigFromFile } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defaultExcluded, getOutputExtensions, getWeappViteConfig } from '../defaults'
import { vitePluginWeapp, vitePluginWeappWorkers } from '../plugins'
import { getAliasEntries, getProjectConfig } from '../utils'

function createConfigService(ctx: MutableCompilerContext): ConfigService {
  const configState = ctx.runtimeState.config
  configState.packageInfo = getPackageInfoSync('weapp-vite')!
  const defineEnv = configState.defineEnv
  let packageManager: DetectResult = configState.packageManager
  let options: LoadConfigResult = configState.options
  const oxcRuntimeInfo = getPackageInfoSync('@oxc-project/runtime')
  const oxcRuntimeHelpersRoot = oxcRuntimeInfo
    ? path.resolve(oxcRuntimeInfo.rootPath, 'src/helpers/esm')
    : undefined
  const NULL_BYTE = '\u0000'
  // eslint-disable-next-line regexp/no-useless-non-capturing-group
  const OXC_RUNTIME_HELPER_ALIAS = new RegExp(`^(?:${NULL_BYTE})?@oxc-project(?:/|\\+)runtime(?:@[^/]+)?/helpers/(.+)\\.js$`)
  const FALLBACK_HELPER_PREFIX = `${NULL_BYTE}weapp-vite:oxc-helper:`
  const fallbackHelpers: Record<string, string> = {
    objectWithoutProperties: `export default function _objectWithoutProperties(source, excluded) {\n  if (source == null) return {};\n  var target = {};\n  var sourceKeys = Object.keys(source);\n  var key;\n  for (var i = 0; i < sourceKeys.length; i++) {\n    key = sourceKeys[i];\n    if (excluded.indexOf(key) >= 0) continue;\n    if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;\n    target[key] = source[key];\n  }\n  if (Object.getOwnPropertySymbols) {\n    var symbolKeys = Object.getOwnPropertySymbols(source);\n    for (var i = 0; i < symbolKeys.length; i++) {\n      key = symbolKeys[i];\n      if (excluded.indexOf(key) >= 0) continue;\n      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;\n      target[key] = source[key];\n    }\n  }\n  return target;\n}`,
    objectSpread2: `function ownKeys(object, enumerableOnly) {\n  var keys = Object.keys(object);\n  if (Object.getOwnPropertySymbols) {\n    var symbols = Object.getOwnPropertySymbols(object);\n    if (enumerableOnly) {\n      symbols = symbols.filter(function(symbol) {\n        return Object.getOwnPropertyDescriptor(object, symbol).enumerable;\n      });\n    }\n    keys.push.apply(keys, symbols);\n  }\n  return keys;\n}\nfunction _objectSpread2(target) {\n  for (var i = 1; i < arguments.length; i++) {\n    var source = arguments[i] != null ? arguments[i] : {};\n    if (i % 2) {\n      ownKeys(Object(source), true).forEach(function(key) {\n        target[key] = source[key];\n      });\n    } else {\n      if (Object.getOwnPropertyDescriptors) {\n        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));\n      } else {\n        ownKeys(Object(source)).forEach(function(key) {\n          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));\n        });\n      }\n    }\n  }\n  return target;\n}\nexport default _objectSpread2;`,
  }
  function getOxcHelperName(id: string) {
    OXC_RUNTIME_HELPER_ALIAS.lastIndex = 0
    const match = OXC_RUNTIME_HELPER_ALIAS.exec(id)
    return match?.[1]
  }
  const rolldownOxcRuntimePlugin: RolldownPlugin | undefined = oxcRuntimeHelpersRoot
    ? {
        name: 'weapp-vite:rolldown-oxc-runtime',
        resolveId(source) {
          if (source.startsWith(NULL_BYTE)) {
            return null
          }
          const helperName = getOxcHelperName(source)
          if (!helperName) {
            return null
          }
          if (!oxcRuntimeHelpersRoot) {
            if (helperName in fallbackHelpers) {
              return `${FALLBACK_HELPER_PREFIX}${helperName}`
            }
            return null
          }
          return path.resolve(oxcRuntimeHelpersRoot, `${helperName}.js`)
        },
        async load(id) {
          if (id.startsWith(FALLBACK_HELPER_PREFIX)) {
            const helperName = id.slice(FALLBACK_HELPER_PREFIX.length)
            const code = fallbackHelpers[helperName]
            if (code) {
              return code
            }
            return null
          }
          const helperName = getOxcHelperName(id)
          if (helperName) {
            if (oxcRuntimeHelpersRoot) {
              const helperPath = id.startsWith(NULL_BYTE)
                ? path.resolve(oxcRuntimeHelpersRoot, `${helperName}.js`)
                : id
              if (await fs.pathExists(helperPath)) {
                console.warn('[weapp-vite] resolving oxc helper via Rolldown plugin:', helperName)
                return fs.readFile(helperPath, 'utf8')
              }
            }
            const fallback = fallbackHelpers[helperName]
            if (fallback) {
              return fallback
            }
          }
          return null
        },
      }
    : undefined

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

  function injectOxcRuntimeAlias(config: InlineConfig) {
    const resolve = config.resolve ?? (config.resolve = {})
    const aliasEntry: AliasEntry & { find: RegExp } = {
      find: OXC_RUNTIME_HELPER_ALIAS,
      replacement: '@oxc-project/runtime/src/helpers/esm/$1.js',
    }
    const cvaAliasEntry: AliasEntry & { find: string } = {
      find: 'class-variance-authority',
      replacement: 'class-variance-authority/dist/index.js',
    }

    const aliasArray = normalizeAliasOptions(resolve.alias)

    const hasAlias = aliasArray.some((entry) => {
      return entry.find instanceof RegExp && entry.find.source === aliasEntry.find.source
    })
    if (!hasAlias) {
      aliasArray.unshift(aliasEntry)
    }

    const hasCvaAlias = aliasArray.some(entry => typeof entry.find === 'string' && entry.find === cvaAliasEntry.find)
    if (!hasCvaAlias) {
      aliasArray.unshift(cvaAliasEntry)
    }

    resolve.alias = aliasArray
  }
  function getDefineImportMetaEnv() {
    const env = {
      MP_PLATFORM: options.platform,
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

    const loaded = await loadConfigFromFile({
      command: isDev ? 'serve' : 'build',
      mode,
    }, resolvedConfigFile, cwd)

    const loadedConfig = loaded?.config

    const srcRoot = loadedConfig?.weapp?.srcRoot ?? ''
    function relativeSrcRoot(p: string) {
      if (srcRoot) {
        return path.relative(srcRoot, p)
      }
      return p
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
              format: 'cjs',
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
    if (rolldownOxcRuntimePlugin) {
      const build = config.build ?? (config.build = {})
      const rdOptions = build.rolldownOptions ?? (build.rolldownOptions = {})
      const rawPlugins = rdOptions.plugins
      const pluginArray: RolldownPluginOption<any>[] = rawPlugins == null
        ? []
        : Array.isArray(rawPlugins)
          ? [...rawPlugins]
          : [rawPlugins]

      const hasPlugin = pluginArray.some((plugin) => {
        if (!plugin || typeof plugin !== 'object') {
          return false
        }
        return 'name' in plugin && (plugin as RolldownPlugin).name === rolldownOxcRuntimePlugin.name
      })

      if (!hasPlugin) {
        rdOptions.plugins = [rolldownOxcRuntimePlugin, ...pluginArray]
      }
      else if (!Array.isArray(rawPlugins)) {
        rdOptions.plugins = pluginArray
      }
    }
    injectOxcRuntimeAlias(config)
    if (oxcRuntimeHelpersRoot) {
      config.plugins ??= []
      config.plugins.unshift({
        name: 'weapp-vite:oxc-runtime-helpers',
        enforce: 'pre',
        resolveId(source) {
          if (source.startsWith(NULL_BYTE)) {
            return null
          }
          if (source.includes('@oxc-project/runtime/helpers')) {
            console.warn('[weapp-vite] resolveId intercepted:', source)
          }
          const helperName = getOxcHelperName(source)
          if (helperName) {
            return path.resolve(oxcRuntimeHelpersRoot, `${helperName}.js`)
          }
          return null
        },
        async load(id) {
          if (!id.startsWith(NULL_BYTE)) {
            return null
          }
          const helperName = getOxcHelperName(id)
          if (!helperName) {
            return null
          }
          const helperPath = path.resolve(oxcRuntimeHelpersRoot, `${helperName}.js`)
          console.warn('[weapp-vite] resolving oxc helper via Vite plugin:', helperName)
          return fs.readFile(helperPath, 'utf8')
        },
      })
    }
    const platform = config.weapp?.platform ?? 'weapp'

    const resolvedOutputExtensions = getOutputExtensions(platform)
    config.plugins ??= []
    config.plugins?.push(tsconfigPaths(config.weapp?.tsconfigPaths))
    const aliasEntries = getAliasEntries(config.weapp?.jsonAlias)

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
      currentSubPackageRoot: undefined,
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
      currentSubPackageRoot: undefined,
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
      injectOxcRuntimeAlias(inline)
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
    injectOxcRuntimeAlias(inlineConfig)
    return inlineConfig
  }

  function merge(subPackageMeta?: SubPackageMetaValue, ...configs: Partial<InlineConfig | undefined>[]) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before merging config')
    }
    options = configState.options
    const external: (string | RegExp)[] = []
    if (options.packageJson.dependencies) {
      external.push(...Object.keys(options.packageJson.dependencies).map((pkg) => {
        return new RegExp(`^${pkg.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\/|$)`)
      }))
    }
    const rolldownOptions: RolldownOptions = {
      external,
      plugins: rolldownOxcRuntimePlugin ? [rolldownOxcRuntimePlugin] : undefined,
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
                options.mpDistRoot ? path.join(options.mpDistRoot, '**') : 'dist/**',
              ],
              include: [path.join(options.srcRoot, '**')],
            },
            minify: false,
            emptyOutDir: false,
            rolldownOptions: {
              ...rolldownOptions,
            },
            sourcemap: true,
          },
        },
      )
      injectOxcRuntimeAlias(inline)
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
          rolldownOptions: {
            ...rolldownOptions,
          },
        },
      },
    )
    inlineConfig.logLevel = 'info'
    injectOxcRuntimeAlias(inlineConfig)
    const currentRoot = subPackageMeta?.subPackage.root
    options = {
      ...options,
      currentSubPackageRoot: currentRoot,
    }
    configState.options = options
    return inlineConfig
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
