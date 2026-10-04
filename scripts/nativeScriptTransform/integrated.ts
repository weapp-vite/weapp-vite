import type { IntegratedBinding, IntegratedMode, IntegratedSnapshot } from './integratedTypes'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { serializeDiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import { scriptBaselineGlobalKey } from '../scriptAnalysisBaseline/installHelpers/source'
import { installCaptureLoader } from './captureLoader'
import { captureTarget } from './captureSource'
import { digest } from './identity'
import { instrumentIntegratedTransform, integratedGlobalKey } from './integratedSource'
import { IntegratedTransformState } from './integratedState'

export type { IntegratedCheck, IntegratedRecord, IntegratedSnapshot, IntegratedWorkerReport } from './integratedTypes'

function transferKey(): symbol | undefined {
  const owner: unknown = Object.getOwnPropertyDescriptor(globalThis, scriptBaselineGlobalKey)?.value
  const key: unknown = owner && typeof owner === 'object' ? Object.getOwnPropertyDescriptor(owner, 'transferKey')?.value : undefined
  if (key !== undefined && typeof key !== 'symbol') {
    throw new TypeError('Existing script AST transfer owner has an unexpected key')
  }
  return key
}

/** 加载失败保留原因供每次真实 stage 回退；显式路径参数错误直接拒绝。 */
export async function loadIntegratedBinding(filename: string): Promise<IntegratedBinding> {
  if (!path.isAbsolute(filename) || path.extname(filename) !== '.node') {
    throw new Error('Integrated native requires an absolute experimental .node path')
  }
  let sha256: string | undefined
  try {
    sha256 = digest(await readFile(filename))
    const binding: unknown = createRequire(import.meta.url)(filename)
    if (!binding || typeof binding !== 'object' || !('transformScriptNative' in binding) || typeof binding.transformScriptNative !== 'function') {
      throw new TypeError('Binding lacks experimental transformScriptNative export')
    }
    return { sha256, invoke: binding.transformScriptNative as (source: string, request: string) => unknown }
  }
  catch (error) {
    return { sha256, loadError: serializeDiagnosticError(error) }
  }
}

/** 只用于独占新进程；显式安装后再创建 optimized-js execution，生产默认不安装。 */
export async function installIntegratedTransform(options: { mode: IntegratedMode, binding?: string }) {
  if (!['control-js', 'native'].includes(options.mode) || (options.mode === 'native') !== (options.binding !== undefined)) {
    throw new Error('Expected control-js without binding or native with an explicit binding')
  }
  if (Object.hasOwn(globalThis, integratedGlobalKey)) {
    throw new Error('Integrated transformScript already installed')
  }
  const binding = options.mode === 'native' ? await loadIntegratedBinding(options.binding!) : {}
  if (Object.hasOwn(globalThis, integratedGlobalKey)) {
    throw new Error('Integrated transformScript was installed while loading the binding')
  }
  const state = new IntegratedTransformState(options.mode, binding, transferKey)
  const loader = installCaptureLoader(new URL(`../../${captureTarget}`, import.meta.url).href, captureTarget, instrumentIntegratedTransform)
  Object.defineProperty(globalThis, integratedGlobalKey, { configurable: true, value: state })
  let disposed = false
  return {
    assertInstalled: () => loader.assertInstalled(),
    snapshot: (): IntegratedSnapshot => ({ mode: options.mode, bindingSha256: binding.sha256, loadError: binding.loadError, loader: loader.snapshot(), records: state.snapshot() }),
    run: <T>(scenarioId: string, execute: () => Promise<T> | T) => {
      loader.assertInstalled()
      return state.run(scenarioId, execute)
    },
    dispose() {
      if (disposed) {
        return
      }
      state.dispose()
      disposed = true
      loader.dispose()
      if (Object.getOwnPropertyDescriptor(globalThis, integratedGlobalKey)?.value !== state) {
        throw new Error('Integrated global ownership changed; foreign owner was preserved')
      }
      delete (globalThis as unknown as Record<string, unknown>)[integratedGlobalKey]
    },
  }
}
