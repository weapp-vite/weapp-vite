import type { OutputBundle, PluginContext } from 'rolldown'
import type { SharedChunkStrategy } from '../../../../types'

export interface SharedChunkDuplicateDetail {
  fileName: string
  importers: string[]
}

export interface SharedChunkDuplicatePayload {
  sharedFileName: string
  duplicates: SharedChunkDuplicateDetail[]
  ignoredMainImporters?: string[]
  requiresRuntimeLocalization?: boolean
  chunkBytes?: number
  redundantBytes?: number
  retainedInMain?: boolean
}

export type SharedChunkFallbackReason = 'main-package' | 'no-subpackage'

export interface SharedChunkFallbackPayload {
  sharedFileName: string
  finalFileName: string
  reason: SharedChunkFallbackReason
  importers: string[]
}

export interface ApplySharedChunkStrategyOptions {
  strategy: SharedChunkStrategy
  subPackageRoots: Iterable<string>
  onDuplicate?: (payload: SharedChunkDuplicatePayload) => void
  onFallback?: (payload: SharedChunkFallbackPayload) => void
}

export interface SharedChunkRuntimeContext {
  pluginContext: PluginContext
  bundle: OutputBundle
  subPackageRoots: string[]
  reservedFileNames: Set<string>
  localizedDuplicateFileMap: Map<string, string>
}
