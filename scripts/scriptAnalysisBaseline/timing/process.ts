import type { ScriptVariant } from '../types'
import type { ScriptTimingReady, ScriptTimingSample, ScriptTimingScenario } from './protocol'
import { createWorkerProcess } from '../../nativeBindingAnalysis/workerProcess'

/** 复用既有进程所有权与退出确认，只适配脚本计时请求。 */
export async function createScriptTimingProcess(variant: ScriptVariant) {
  const worker = await createWorkerProcess<{ scenario: ScriptTimingScenario }, ScriptTimingReady, ScriptTimingSample>({
    worker: new URL('./worker.ts', import.meta.url),
    args: [variant],
    label: `Script compiler ${variant}`,
    env: { WEAPP_VITE_NATIVE: '0' },
  })
  return {
    ready: worker.ready,
    compile: (scenario: ScriptTimingScenario) => worker.compile({ scenario }),
    close: () => worker.close(),
  }
}
