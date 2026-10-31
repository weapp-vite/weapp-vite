export type LanguagePlatform = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs' | 'qq' | 'ks' | 'ty'

export interface SourceRange {
  start: number
  end: number
}

export interface SourceEdit extends SourceRange {
  newText: string
}

export interface Diagnostic extends SourceRange {
  code: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

export interface LanguageOptions {
  platform?: LanguagePlatform
  defaultPlatform?: LanguagePlatform
  overrides?: { files: string[], platform: LanguagePlatform }[]
}

export interface DocumentInput {
  source: string
  fileName: string
  platform?: LanguagePlatform
  options?: LanguageOptions
  sourceKind?: 'native' | 'compiled'
  dialect?: 'wxs' | 'sjs' | 'ks' | 'javascript'
  language?: 'javascript' | 'typescript'
}

/** 语言错误保留结构化诊断，调用方可安全地拒绝全部写入。 */
export class LanguageError extends Error {
  diagnostics: Diagnostic[]

  constructor(fileName: string, diagnostics: Diagnostic[]) {
    super(diagnostics.map(diagnostic => `${fileName}:${diagnostic.start + 1}: ${diagnostic.message}`).join('\n'))
    this.name = 'LanguageError'
    this.diagnostics = diagnostics
  }
}
