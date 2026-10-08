import type { ScriptVariant } from '../types'
import type { ScriptTimingRequest, ScriptTimingResponse, ScriptTimingSample } from './protocol'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { createWorkerLifecycle } from '../../nativeBindingAnalysis/workerLifecycle'
import { createScriptExecution } from '../execution'
import { SCRIPT_VARIANTS } from '../types'

const lifecycle = createWorkerLifecycle()

function send(value: ScriptTimingResponse) {
  return lifecycle.send(value)
}

/** 每种实现独占常驻进程；计时仅包围完整 compileVueFile 调用。 */
async function main() {
  const variant = process.argv[2] as ScriptVariant
  if (!SCRIPT_VARIANTS.includes(variant) || !process.send) {
    throw new Error('Expected <script variant> and an owned IPC channel')
  }
  const execution = await createScriptExecution(variant)
  lifecycle.setDispose(() => execution.dispose())
  let running = false
  process.on('message', (request: ScriptTimingRequest) => lifecycle.run(async () => {
    if (running) {
      send({ id: request.id, kind: 'error', message: 'Overlapping script compiler requests' })
      return
    }
    running = true
    try {
      if (request.kind === 'close') {
        lifecycle.close({ id: request.id, kind: 'closed' })
        return
      }
      if (request.kind !== 'compile' || request.scenario.kind !== 'sfc') {
        throw new Error('Script timing requires an SFC compile scenario')
      }
      let measurement: Pick<ScriptTimingSample, 'wallMs' | 'cpuMicroseconds' | 'rssAfterBytes'> | undefined
      const result = await execution.execute(request.scenario, async (compile) => {
        const initialCpu = process.cpuUsage()
        const start = performance.now()
        try {
          return await compile()
        }
        finally {
          const wallMs = performance.now() - start
          const cpu = process.cpuUsage(initialCpu)
          measurement = { wallMs, cpuMicroseconds: cpu.user + cpu.system, rssAfterBytes: process.memoryUsage().rss }
        }
      })
      if (!measurement) {
        throw new Error('Script compile did not enter its timing boundary')
      }
      const { warnings: _warnings, ...sample } = result
      send({ id: request.id, kind: 'result', result: { ...sample, ...measurement } })
    }
    catch (error) {
      send({ id: request.id, kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
    finally {
      running = false
    }
  }))
  send({ id: 0, kind: 'ready', sourceHashes: execution.sourceHashes })
}

lifecycle.run(main).catch(async (error: unknown) => {
  await send({ id: 0, kind: 'error', message: error instanceof Error ? error.message : String(error) })
  lifecycle.close(undefined, 1)
})
