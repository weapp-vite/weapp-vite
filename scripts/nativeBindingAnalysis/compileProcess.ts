import type { CompileResponse, CompileSample, CompileScenario, CompileVariant } from './compileProtocol'
import { createWorkerProcess } from './workerProcess'

/** 保留编译采样入口，将进程与 IPC 所有权交给通用传输层。 */
export async function createCompileProcess(variant: CompileVariant, binding: string) {
  const worker = await createWorkerProcess<
    { scenario: CompileScenario },
    Extract<CompileResponse, { kind: 'ready' }>,
    CompileSample
  >({
    worker: new URL('./compileWorker.ts', import.meta.url),
    args: [variant, binding],
    label: `Compiler ${variant}`,
    env: { WEAPP_VITE_NATIVE: '0' },
  })
  return {
    ready: worker.ready,
    compile: (scenario: CompileScenario) => worker.compile({ scenario }),
    close: worker.close,
  }
}
