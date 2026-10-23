import { WorkspaceHmrClassicFallback } from '../../../../scripts/workspace-hmr/classicFallback'

export interface AutoImportHmrRuntimeObservation {
  runtimeBefore: 'stateful-experimental' | 'classic'
  runtimeAfter: 'stateful-experimental' | 'classic'
  fallbackReason?: string
  classicReadyVerified?: true
}

/** 模板标记会改变原生注册；只接受该已知回退，并核验同一会话的 ready 与完整 classic 产物。 */
export function createAutoImportHmrFallback(distRoot: string, getOutput: () => string, requireStateful = false) {
  const fallback = new WorkspaceHmrClassicFallback(distRoot, getOutput)
  const assertDiagnosticRuntime = () => {
    if (requireStateful && fallback.requested) {
      throw new Error(`Auto-import HMR stateful diagnostic cannot accept classic fallback: ${fallback.fallbackReason}`)
    }
  }
  return {
    assertDiagnosticRuntime,
    get actualMode() {
      return fallback.actualMode
    },
    get evidence() {
      return fallback.actualMode === 'classic'
        ? { fallbackReason: fallback.fallbackReason!, classicReadyVerified: true as const }
        : undefined
    },
    async isClassicFallback(signal: AbortSignal, deadline: number) {
      if (!fallback.requested) {
        return false
      }
      if (fallback.fallbackReason !== 'native-registration') {
        throw new Error(`Unexpected auto-import HMR fallback: ${fallback.fallbackReason}`)
      }
      assertDiagnosticRuntime()
      return fallback.settle({ signal, deadline })
    },
  }
}
