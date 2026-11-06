import type { NativeNpmChunkAnalysis, ScriptAnalysisResult } from '../../../../../ast'

export interface ContentScriptAnalysis {
  analysis: Pick<ScriptAnalysisResult, 'hasPlatformApiAccess' | 'hasStaticRequireLiteral'>
  npmChunkAnalysis?: NativeNpmChunkAnalysis
}

/** 仅保存源码决定的分析事实，不保存 chunk、AST、hook 或构建上下文。 */
export class ContentAnalysisCache {
  private readonly entries = new Map<string, ContentScriptAnalysis>()
  private codeBytes = 0

  constructor(
    private readonly maxEntries = 256,
    private readonly maxCodeBytes = 8 * 1024 * 1024,
  ) {}

  get(code: string, engine: 'babel' | 'oxc' = 'babel', filename = '') {
    const key = `${engine}\0${filename}\0${code}`
    const value = this.entries.get(key)
    if (value) {
      this.entries.delete(key)
      this.entries.set(key, value)
    }
    return value
  }

  set(code: string, engine: 'babel' | 'oxc' | undefined, value: ContentScriptAnalysis, filename = '') {
    // native parser 由文件名确定 SourceType，不能混用相同字节的 cjs/mjs/ts 事实。
    const key = `${engine ?? 'babel'}\0${filename}\0${code}`
    const bytes = key.length * 2
    if (this.maxEntries <= 0 || bytes > this.maxCodeBytes) {
      return
    }
    if (this.entries.delete(key)) {
      this.codeBytes -= bytes
    }
    this.entries.set(key, value)
    this.codeBytes += bytes
    while (this.entries.size > this.maxEntries || this.codeBytes > this.maxCodeBytes) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) {
        break
      }
      this.entries.delete(oldest)
      this.codeBytes -= oldest.length * 2
    }
  }
}
