import type { InlineConfig } from 'vite'
import type { MutableCompilerContext } from '../../../../context'
import { defu } from '@weapp-core/shared'
import { requireConfigService } from '../../../utils/requireConfigService'

export function ensureConfigService(ctx: MutableCompilerContext) {
  requireConfigService(ctx, '合并配置前必须初始化 configService。')
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
