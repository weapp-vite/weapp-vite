import type { CompilerDiagnostic } from '../../../types/diagnostics'

export function createJsxDiagnostics(warnings: string[], filename: string): CompilerDiagnostic[] {
  return warnings.map((warning) => {
    const message = warning.startsWith('[JSX 编译]') ? warning : `[JSX 编译] ${warning}`
    return {
      code: 'WV1003',
      severity: 'warning',
      message,
      filename,
      source: 'jsx',
    }
  })
}
