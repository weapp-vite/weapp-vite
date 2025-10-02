import type { DetectResult } from 'package-manager-detector'
import type { PackageJson } from 'pkg-types'
import type { RolldownOptions } from 'rolldown'
import type { InlineConfig, Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { OutputExtensions } from '../defaults'
import type { MpPlatform, ResolvedAlias, SubPackageMetaValue } from '../types'
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

export interface LoadConfigOptions {
  cwd: string
  isDev: boolean
  mode: string
  inlineConfig?: InlineConfig
  configFile?: string
}

export interface LoadConfigResult {
  config: InlineConfig
  aliasEntries: ResolvedAlias[]
  outputExtensions: OutputExtensions
  packageJson: PackageJson
  relativeSrcRoot: (p: string) => string
  cwd: string
  isDev: boolean
  mode: string
  projectConfig: Record<string, any>
  mpDistRoot: string
  packageJsonPath: string
  platform: MpPlatform
  srcRoot: string
}

interface PackageInfo {
  name: string
  version: string | undefined
  rootPath: string
  packageJsonPath: string
  packageJson: PackageJson
}

export interface ConfigService {
  options: LoadConfigResult
  outputExtensions: OutputExtensions
  defineEnv: Record<string, any>
  packageManager: DetectResult
  packageInfo: PackageInfo
  setDefineEnv: (key: string, value: any) => void
  load: (options?: Partial<LoadConfigOptions>) => Promise<LoadConfigResult>
  mergeWorkers: (...configs: Partial<InlineConfig>[]) => InlineConfig
  merge: (subPackageMeta?: SubPackageMetaValue, ...configs: Partial<InlineConfig | undefined>[]) => InlineConfig
  readonly defineImportMetaEnv: Record<string, any>
  readonly cwd: string
  readonly isDev: boolean
  readonly mpDistRoot: string
  readonly outDir: string
  readonly inlineConfig: InlineConfig
  readonly weappViteConfig: NonNullable<InlineConfig['weapp']>
  readonly packageJson: PackageJson
  readonly projectConfig: Record<string, any>
  readonly srcRoot: string
  readonly pluginRoot: string | undefined
  readonly absolutePluginRoot: string | undefined
  readonly absoluteSrcRoot: string
  readonly mode: string
  readonly aliasEntries: ResolvedAlias[]
  readonly platform: MpPlatform
  relativeCwd: (p: string) => string
  relativeSrcRoot: (p: string) => string
  relativeAbsoluteSrcRoot: (p: string) => string
}

function createConfigService(ctx: MutableCompilerContext): ConfigService {
  const packageInfo = getPackageInfoSync('weapp-vite')!
  const defineEnv: Record<string, any> = {}
  let packageManager: DetectResult = {
    agent: 'npm',
    name: 'npm',
  }
  const defaults: LoadConfigResult = {
    config: {},
    aliasEntries: [],
    outputExtensions: {
      css: '.css',
      js: '.js',
      json: '.json',
      wxml: '.wxml',
      wxss: '.wxss',
    },
    packageJson: {},
    relativeSrcRoot: p => p,
    cwd: process.cwd(),
    isDev: false,
    mode: 'development',
    projectConfig: {},
    mpDistRoot: '',
    packageJsonPath: '',
    platform: 'weapp',
    srcRoot: '',
  }

  let options: LoadConfigResult = defaults
  let outputExtensions = getOutputExtensions('weapp')

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
    })

    options = resolvedConfig
    outputExtensions = getOutputExtensions(resolvedConfig.platform)
    packageManager = (await detect()) ?? {
      agent: 'npm',
      name: 'npm',
    }

    return resolvedConfig
  }

  function mergeWorkers(...configs: Partial<InlineConfig>[]) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before merging workers config')
    }

    if (options.isDev) {
      return defu<InlineConfig, InlineConfig[]>(
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
    return inlineConfig
  }

  function merge(subPackageMeta?: SubPackageMetaValue, ...configs: Partial<InlineConfig | undefined>[]) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before merging config')
    }
    const external: (string | RegExp)[] = []
    if (options.packageJson.dependencies) {
      external.push(...Object.keys(options.packageJson.dependencies).map((pkg) => {
        return new RegExp(`^${pkg.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\/|$)`)
      }))
    }
    const rolldownOptions: RolldownOptions = {
      external,
    }
    if (options.isDev) {
      return defu<InlineConfig, (InlineConfig | undefined)[]>(
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
    return inlineConfig
  }

  return {
    get options() {
      return options
    },
    set options(value: LoadConfigResult) {
      options = value
    },
    get outputExtensions() {
      return outputExtensions
    },
    set outputExtensions(value: OutputExtensions) {
      outputExtensions = value
    },
    defineEnv,
    packageManager,
    packageInfo,
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
