import type { InlineConfig } from 'vite'
import type { MutableCompilerContext } from '../../../context'
import { defu } from '@weapp-core/shared'
import { requireConfigService } from '../../utils/requireConfigService'

export function ensureConfigService(ctx: MutableCompilerContext) {
  requireConfigService(ctx, 'configService must be initialized before merging config')
}

export function mergeInlineConfig(
  config: InlineConfig,
  injectBuiltinAliases: (config: InlineConfig) => void,
  ...configs: Partial<InlineConfig>[]
) {
  const merged = defu<InlineConfig, InlineConfig[]>(
    config,
    ...configs,
  )
  injectBuiltinAliases(merged)
  return merged
}
