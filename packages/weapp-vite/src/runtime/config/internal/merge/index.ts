import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig } from 'vite'
import type { MutableCompilerContext } from '../../../../context'
import type { SubPackageMetaValue } from '../../../../types'
import type { LoadConfigResult } from '../../types'
import { platformBackendRegistry } from '../../../../backends'
import { createSharedBuildOutput } from '../../../sharedBuildConfig'
import { ensureConfigService, mergeInlineConfig } from './inline'
import { mergeMiniprogram } from './miniprogram'
import { mergeWeb } from './web'
import { mergeWorkers } from './workers'

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

  function mergeWorkersFactory(...configs: Partial<InlineConfig>[]) {
    ensureConfigService(ctx)
    const currentOptions = getOptions()
    const configService = ctx.configService!
    const subPackageRoots = Object.keys(configService.weappViteConfig?.subPackages ?? {})
    const sharedOutput = configService.options.chunksConfigured
      ? createSharedBuildOutput(configService, () => subPackageRoots)
      : undefined
    return mergeWorkers({
      ctx,
      isDev: currentOptions.isDev,
      config: currentOptions.config,
      cwd: currentOptions.cwd,
      injectBuiltinAliases,
      getDefineImportMetaEnv,
      applyRuntimePlatform,
    }, sharedOutput ? { build: { rolldownOptions: { output: sharedOutput } } } : {}, ...configs)
  }

  function mergeFactory(subPackageMeta: SubPackageMetaValue | undefined, ...configs: Partial<InlineConfig | undefined>[]) {
    ensureConfigService(ctx)
    const backend = platformBackendRegistry.get('miniprogram')
    if (!backend) {
      throw new Error('小程序平台后端未注册。')
    }
    const currentOptions = getOptions()
    return backend.driver.mergeConfig({
      merge: (...backendConfigs) => mergeMiniprogram({
        ctx,
        subPackageMeta,
        config: currentOptions.config,
        cwd: currentOptions.cwd,
        srcRoot: currentOptions.srcRoot,
        mpDistRoot: currentOptions.mpDistRoot,
        configFileDependencies: currentOptions.configFileDependencies,
        packageJson: currentOptions.packageJson,
        isDev: currentOptions.isDev,
        applyRuntimePlatform,
        injectBuiltinAliases,
        getDefineImportMetaEnv,
        setOptions: next => setOptions({
          ...currentOptions,
          ...next,
        }),
        oxcRolldownPlugin,
      }, ...backendConfigs),
    }, ...configs)!
  }

  function mergeWebFactory(...configs: Partial<InlineConfig | undefined>[]) {
    ensureConfigService(ctx)
    const backend = platformBackendRegistry.get('web')
    if (!backend) {
      throw new Error('Web 平台后端未注册。')
    }
    const currentOptions = getOptions()
    const configService = ctx.configService!
    const subPackageRoots = Object.keys(configService.weappViteConfig?.subPackages ?? {})
    const sharedOutput = configService.options.chunksConfigured
      ? createSharedBuildOutput(configService, () => subPackageRoots)
      : undefined
    return backend.driver.mergeConfig({
      merge: (...backendConfigs) => mergeWeb({
        config: currentOptions.config,
        web: currentOptions.weappWeb,
        mode: currentOptions.mode,
        isDev: currentOptions.isDev,
        applyRuntimePlatform,
        injectBuiltinAliases,
        getDefineImportMetaEnv,
      }, sharedOutput
        ? {
            build: {
              rolldownOptions: { output: sharedOutput },
            },
          }
        : {}, ...backendConfigs),
    }, ...configs)
  }

  function mergeInlineFactory(...configs: Partial<InlineConfig>[]) {
    const currentOptions = getOptions()
    return mergeInlineConfig(currentOptions.config, injectBuiltinAliases, ...configs)
  }

  return {
    mergeWorkers: mergeWorkersFactory,
    merge: mergeFactory,
    mergeWeb: mergeWebFactory,
    mergeInlineConfig: mergeInlineFactory,
  }
}
