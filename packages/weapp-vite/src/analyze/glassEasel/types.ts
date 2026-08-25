export type GlassEaselDiagnosticCode
  = | 'GE001'
    | 'GE002'
    | 'GE003'
    | 'GE004'
    | 'GE005'
    | 'GE006'

export type GlassEaselDiagnosticSeverity = 'error' | 'warning'

export interface GlassEaselDiagnostic {
  code: GlassEaselDiagnosticCode
  severity: GlassEaselDiagnosticSeverity
  message: string
  file: string
  line?: number
  column?: number
  normalized?: boolean
}

export interface GlassEaselAnalyzeResult {
  detected: boolean
  minimumBaseLibrary: '3.8.12'
  migrationGuide: string
  diagnostics: GlassEaselDiagnostic[]
  summary: {
    errors: number
    warnings: number
  }
}

export interface GlassEaselTemplateFinding {
  code: Extract<GlassEaselDiagnosticCode, 'GE002' | 'GE003' | 'GE004'>
  severity: GlassEaselDiagnosticSeverity
  message: string
  start: number
  normalized?: boolean
}
