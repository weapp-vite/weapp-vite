export interface HmrCompilerOutputRequest {
  fileName: string
  code: string
  sourcemap?: boolean
  entryId?: string
  state?: unknown
}

export interface HmrCompilerTransformResult {
  code: string
  entryId?: string
  map?: unknown
  dependencies?: string[]
  invalidated?: string[]
  handled?: boolean
  state?: unknown
}

export interface HmrCompilerRequest {
  /** 宿主封存的输入版本，不等同于客户端执行版本。 */
  revision: number
  changedFiles: readonly string[]
  sources: ReadonlyMap<string, string | null>
}

export interface HmrCompilerAsset {
  fileName: string
  code: string
}

export interface HmrCompilerPreparation {
  assets?: readonly HmrCompilerAsset[]
  dependencies?: readonly string[]
  invalidated?: readonly string[]
  transformJavaScript?: (request: HmrCompilerOutputRequest) => HmrCompilerTransformResult | null | Promise<HmrCompilerTransformResult | null>
  transformTemplate?: (request: HmrCompilerOutputRequest) => HmrCompilerTransformResult | null | Promise<HmrCompilerTransformResult | null>
  /** 批次确认或取消后释放固定的编译状态。 */
  dispose?: () => void | Promise<void>
}

export interface HmrCompilerProvider {
  prepareHmr?: (request: HmrCompilerRequest) => HmrCompilerPreparation | Promise<HmrCompilerPreparation>
}
