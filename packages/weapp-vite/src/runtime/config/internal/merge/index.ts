import type { RolldownPluginOption } from 'rolldown'
import type { InlineConfig } from 'vite'
import type { MutableCompilerContext } from '../../../../context'
import type { SubPackageMetaValue } from '../../../../types'
import type { LoadConfigResult } from '../../types'
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
    return mergeWorkers({
      ctx,
      isDev: currentOptions.isDev,
      config: currentOptions.config,
      cwd: currentOptions.cwd,
      injectBuiltinAliases,
      getDefineImportMetaEnv,
      applyRuntimePlatform,
    }, ...configs)
  }

  function mergeFactory(subPackageMeta: SubPackageMetaValue | undefined, ...configs: Partial<InlineConfig | undefined>[]) {
    ensureConfigService(ctx)
    const currentOptions = getOptions()
    return mergeMiniprogram({
      ctx,
      subPackageMeta,
      config: currentOptions.config,
      cwd: currentOptions.cwd,
      srcRoot: currentOptions.srcRoot,
      mpDistRoot: currentOptions.mpDistRoot,
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
    }, ...configs)
  }

  function mergeWebFactory(...configs: Partial<InlineConfig | undefined>[]) {
    ensureConfigService(ctx)
    const currentOptions = getOptions()
    return mergeWeb({
      config: currentOptions.config,
      mode: currentOptions.mode,
      isDev: currentOptions.isDev,
      applyRuntimePlatform,
      injectBuiltinAliases,
      getDefineImportMetaEnv,
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
