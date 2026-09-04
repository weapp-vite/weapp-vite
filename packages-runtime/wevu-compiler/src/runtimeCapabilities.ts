import type { WevuBindingManifestV1 } from './types/bindingManifest'

/**
 * wevu 编译器内部使用的运行时能力规范顺序。
 *
 * @internal
 */
export const WE_VU_RUNTIME_CAPABILITY_ORDER = [
  'patchStrategy',
  'templateRefs',
  'inlineEvents',
  'setDataHighFrequencyWarning',
  'scopedSlots',
  'layout',
] as const

/**
 * wevu 编译器内部使用的运行时能力名称。
 *
 * @internal
 */
export type WevuRuntimeCapabilityName = (typeof WE_VU_RUNTIME_CAPABILITY_ORDER)[number]

/**
 * compiler 各阶段与 bundler 之间传递的内部运行时能力元数据。
 *
 * @internal
 */
export interface WevuRuntimeCapabilityMetadata {
  required: WevuRuntimeCapabilityName[]
  conservative?: WevuRuntimeCapabilityName[]
}

/**
 * wevu 编译器内部使用的能力安装函数名称映射。
 *
 * @internal
 */
export const WE_VU_RUNTIME_CAPABILITY_INSTALLERS = {
  patchStrategy: 'installPatchStrategy',
  templateRefs: 'installTemplateRefs',
  inlineEvents: 'installInlineEvents',
  setDataHighFrequencyWarning: 'installSetDataHighFrequencyWarning',
  scopedSlots: 'installScopedSlots',
  layout: 'installLayout',
} as const satisfies Record<WevuRuntimeCapabilityName, string>

/**
 * 规范化编译器内部运行时能力元数据，并补齐能力依赖。
 *
 * @internal
 */
export function createWevuRuntimeCapabilityMetadata(
  required: Iterable<WevuRuntimeCapabilityName>,
  conservative: Iterable<WevuRuntimeCapabilityName> = [],
): WevuRuntimeCapabilityMetadata | undefined {
  const requiredSet = new Set(required)
  if (requiredSet.has('layout')) {
    requiredSet.add('templateRefs')
  }
  const sortedRequired = WE_VU_RUNTIME_CAPABILITY_ORDER.filter(name => requiredSet.has(name))
  if (!sortedRequired.length) {
    return undefined
  }
  const conservativeSet = new Set(conservative)
  const sortedConservative = sortedRequired.filter(name => conservativeSet.has(name))
  return {
    required: sortedRequired,
    ...(sortedConservative.length ? { conservative: sortedConservative } : {}),
  }
}

/**
 * 从最终 Binding Manifest 派生内部运行时能力。
 *
 * @internal
 */
export function createWevuRuntimeCapabilityMetadataFromBindingManifest(
  manifest: WevuBindingManifestV1,
): WevuRuntimeCapabilityMetadata | undefined {
  const required: WevuRuntimeCapabilityName[] = []
  const features = manifest.features
  if (features.templateRefs) {
    required.push('templateRefs')
  }
  if (features.inlineEvents) {
    required.push('inlineEvents')
  }
  if (features.scopedSlots) {
    required.push('scopedSlots')
  }
  if (features.layout) {
    required.push('layout')
  }
  return createWevuRuntimeCapabilityMetadata(required)
}

/**
 * 合并多层编译结果中的内部运行时能力元数据。
 *
 * @internal
 */
export function mergeWevuRuntimeCapabilityMetadata(
  ...metadata: Array<WevuRuntimeCapabilityMetadata | undefined>
): WevuRuntimeCapabilityMetadata | undefined {
  const required = new Set<WevuRuntimeCapabilityName>()
  const conservative = new Set<WevuRuntimeCapabilityName>()
  for (const item of metadata) {
    item?.required.forEach(name => required.add(name))
    item?.conservative?.forEach(name => conservative.add(name))
  }
  return createWevuRuntimeCapabilityMetadata(required, conservative)
}
