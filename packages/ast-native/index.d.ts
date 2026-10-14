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

export interface NativeCompilerScriptInput {
  code: string
  filename?: string
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
  defineOptionsStatements: NativeCompilerScriptSpan[]
  registeredComponents?: NativeCompilerRegisteredComponent[]
}

export interface NativeNpmChunkAnalysisInput {
  code: string
  filename?: string
}

export interface NativeNpmRequireFact {
  start: number
  end: number
  importee: string
}

export interface NativeNpmPlatformApiFact {
  start: number
  end: number
}

export interface NativeNpmLocalRootFact {
  kind: 'alias' | 'require' | 'interop'
  requireIndex?: number
  bindingName?: string
  referenceName?: string
  importee?: string
  secondArgumentStart?: number
  secondArgumentEnd?: number
}

export interface NativeNpmChunkAnalysis {
  requires: NativeNpmRequireFact[]
  platformApiRanges: NativeNpmPlatformApiFact[]
  localRootFacts: NativeNpmLocalRootFact[]
}

export function analyzeNpmChunksNative(
  inputs: NativeNpmChunkAnalysisInput[],
): Array<NativeNpmChunkAnalysis | null>

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
