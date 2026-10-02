export interface AnalyzeModuleOwner {
  name: string
  version?: string
}

export type AnalyzeModuleCategory = 'runtime' | 'reactivity' | 'host' | 'helper' | 'application' | 'dependency' | 'unknown'

export interface AnalyzeArtifactModule {
  source: string
  package?: AnalyzeModuleOwner
  category: AnalyzeModuleCategory
  /** 打包器提供的模块长度，不保证等于最终 UTF-8 字节。 */
  renderedLength?: number
  /** 按模块长度占比分摊的最终字节估算，不是独立压缩结果。 */
  estimatedBytes: number
}

export interface AnalyzeArtifact {
  file: string
  packageId: string
  origin: 'main' | 'independent'
  type: 'chunk' | 'asset'
  bytes: number
  sha256?: string
  role: 'runtime' | 'application' | 'dependency' | 'mixed' | 'unknown' | 'asset'
  classification: 'module-ownership' | 'asset' | 'unavailable'
  estimation: 'rendered-length-proportional'
  modules: AnalyzeArtifactModule[]
  runtimeEstimatedBytes: number
  unattributedBytes: number
}

export interface AnalyzeArtifactAnalysis {
  files: AnalyzeArtifact[]
  /** 各物理文件只计一次；不能再加上 runtime 或重复模块估算。 */
  totalBytes: number
  /** 同一模块在多个物理文件中的估算总量减去最大单份，不是可保证节省量。 */
  duplicateEstimatedBytes: number
  runtime: {
    estimatedBytes: number
    /** 包含 runtime 模块的所有文件实际字节，包括混合 chunk 中的业务代码。 */
    upperBoundBytes: number
    unknownFiles: string[]
  }
}
