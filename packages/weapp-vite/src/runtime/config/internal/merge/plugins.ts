import type { InlineConfig, PluginOption } from 'vite'
import type { MutableCompilerContext } from '../../../context'
import type { SubPackageMetaValue } from '../../../types'
import { vitePluginWeapp, WEAPP_VITE_CONTEXT_PLUGIN_NAME } from '../../../plugins'

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

export function arrangePlugins(
  config: InlineConfig,
  ctx: MutableCompilerContext,
  subPackageMeta: SubPackageMetaValue | undefined,
) {
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
