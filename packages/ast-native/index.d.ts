export interface NativeOnPageScrollDiagnostic {
  kind: 'empty' | 'setData' | 'syncApi'
  line: number
  column: number
  sourceLabel: string
  syncApi?: string
}

export function collectOnPageScrollDiagnosticsNative(
  code: string,
  filename?: string,
): NativeOnPageScrollDiagnostic[]

export function getVueSfcSignaturePayloadNative(source: string): string | undefined
