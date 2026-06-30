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
}

export interface NativeScriptAnalysisInput {
  code: string
  moduleId?: string
  hookToFeatureJson?: string
  filename?: string
}

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
