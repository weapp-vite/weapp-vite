import { resetTakeImportRegistry } from './state'

export { applyRuntimeChunkLocalization, applySharedChunkStrategy } from './apply'
export type {
  ApplyRuntimeChunkLocalizationOptions,
  ApplySharedChunkStrategyOptions,
  RuntimeChunkDuplicateDetail,
  RuntimeChunkDuplicatePayload,
  SharedChunkDuplicateDetail,
  SharedChunkDuplicatePayload,
  SharedChunkFallbackPayload,
  SharedChunkFallbackReason,
} from './apply'
export {
  DEFAULT_SHARED_CHUNK_STRATEGY,
  SHARED_CHUNK_VIRTUAL_PREFIX,
  SUB_PACKAGE_SHARED_DIR,
} from './constants'
export { resolveSharedChunkName } from './naming'
export type { ResolveSharedChunkNameOptions } from './naming'
export { markTakeModuleImporter, resetTakeImportRegistry } from './state'

/**
 * @internal
 */
export function __clearSharedChunkDiagnosticsForTest() {
  resetTakeImportRegistry()
}
