export interface NativeOnPageScrollDiagnostic {
  kind: 'empty' | 'setData' | 'syncApi'
  line: number
  column: number
  sourceLabel: string
  syncApi?: string
}

export interface NativeScriptAnalysis {
  hasStaticRequireLiteral: boolean
  hasPlatformApiAccess: boolean
  featureFlags: string[]
  onPageScrollDiagnostics?: NativeOnPageScrollDiagnostic[]
}

export interface NativeScriptAnalysisInput {
  code: string
  moduleId?: string
  hookToFeatureJson?: string
  filename?: string
}

export interface NativeCompilerScriptInput {
  code: string
  filename?: string
  moduleId?: string
  hookToFeatureJson?: string
}

export interface NativeCompilerScriptImport {
  local: string
  imported?: string
  source: string
  kind: 'default' | 'namespace' | 'named'
  typeOnly: boolean
}

export interface NativeCompilerRegisteredComponent {
  name: string
  local: string
}

export interface NativeCompilerScriptSpan {
  start: number
  end: number
}

export interface NativeCompilerScriptAnalysis {
  imports: NativeCompilerScriptImport[]
  hasDefaultExport: boolean
  defineOptionsName?: string
  defineOptionsStatements: NativeCompilerScriptSpan[]
  registeredComponents?: NativeCompilerRegisteredComponent[]
  isMiniProgramComponent: boolean
  hasStaticRequireLiteral: boolean
  hasPlatformApiAccess: boolean
  featureFlags: string[]
}

export function analyzeCompilerScriptsNative(
  inputs: NativeCompilerScriptInput[],
): Array<NativeCompilerScriptAnalysis | null>

export function analyzeScriptNative(
  code: string,
  moduleId?: string,
  hookToFeatureJson?: string,
  filename?: string,
): NativeScriptAnalysis

export function analyzeScriptsNative(inputs: NativeScriptAnalysisInput[]): NativeScriptAnalysis[]

export function collectOnPageScrollDiagnosticsNative(
  code: string,
  filename?: string,
): NativeOnPageScrollDiagnostic[]

export function getVueSfcSignaturePayloadNative(source: string): string | undefined

export function mayContainStaticRequireLiteralNative(
  code: string,
  filename?: string,
): boolean

export function mayContainPlatformApiAccessNative(
  code: string,
  filename?: string,
): boolean

export function collectFeatureFlagsNative(
  code: string,
  moduleId: string,
  hookToFeatureJson: string,
  filename?: string,
): string[]
