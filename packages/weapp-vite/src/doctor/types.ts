import type { AnalyzeBudgetConfig } from '../analyze/subpackages/types'
import type { MpPlatform } from '../types'

export type DoctorLayer = 'project' | 'source' | 'artifact' | 'runtime'
export interface DoctorCoverage {
  target: string
  layer: DoctorLayer
  check: string
  status: 'complete' | 'incomplete' | 'not-requested'
  reason?: string
}
export interface DoctorDiagnostic {
  ruleId: string
  target: string
  layer: DoctorLayer
  severity: 'error' | 'warning'
  message: string
  location?: { file: string, line?: number, column?: number }
  evidence: { expected: string, actual: string }
  responsibility: { owner: 'project' | 'framework' | 'platform' | 'unknown', confidence: 'confirmed' | 'suspected' }
  suggestion: string
  fingerprint: string
}
export interface DoctorFile {
  path: string
  size: number
  sha256: string
  text?: string
}
export interface DoctorArtifactSnapshot {
  files: readonly DoctorFile[]
  origin: 'build' | 'existing'
  capturedAt: string
  /** 既有目录只证明当前字节，不证明来自当前源码。 */
  freshness: 'current-build' | 'unverified'
  budgets?: AnalyzeBudgetConfig
  /** 相对项目目录的实际编译源码目录。 */
  sourceRoot?: string
  /** 相对项目目录的本轮输出目录。 */
  outputRoot?: string
  limitations?: readonly string[]
}
export interface DoctorRuntimeEvidence {
  host: string
  deviceSystem?: string
  route: string
  provider: string
  checks: readonly string[]
}
export interface DoctorReport {
  schemaVersion: 1
  generatedAt: string
  targets: string[]
  coverage: DoctorCoverage[]
  diagnostics: DoctorDiagnostic[]
  artifacts: Record<string, Omit<DoctorArtifactSnapshot, 'files'> & { files: Array<Omit<DoctorFile, 'text'>> }>
  runtime: Record<string, DoctorRuntimeEvidence>
  exitCode: 0 | 1 | 2
}
export interface DoctorOptions {
  cwd?: string
  targets?: readonly string[]
  /** 静态检查的显式源码目录；不执行配置推断。 */
  source?: string
  artifact?: string
  build?: boolean
  runtime?: boolean
  /** 连接已有 automator 会话的端口；省略时使用项目派生端口。 */
  runtimePort?: number
  configFile?: string
  onBuildLog?: (text: string) => void
}
export interface DoctorAdapters {
  build: (options: DoctorOptions, target: MpPlatform) => Promise<DoctorArtifactSnapshot>
  runtime: (cwd: string, target: MpPlatform, port?: number) => Promise<DoctorRuntimeEvidence>
}
