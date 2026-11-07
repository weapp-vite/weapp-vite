import type { CompilerContext } from '../../../../context'

/** 原生插槽上下文必须由微信平台及两个显式模板选项共同启用。 */
export function usesNativeSlotOwnerRuntime(config: Pick<NonNullable<CompilerContext['configService']>, 'platform' | 'weappViteConfig'>) {
  const template = config.weappViteConfig?.vue?.template
  return config.platform === 'weapp' && template?.nativeSlotContext === true && template.scopedSlotsRequireProps === true
}
