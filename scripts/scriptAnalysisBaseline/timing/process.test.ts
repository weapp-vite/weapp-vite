import type { ScriptTimingSample, ScriptTimingScenario } from './protocol'
import { expect, it, vi } from 'vitest'
import { createScriptTimingProcess } from './process'

const { createWorkerProcess } = vi.hoisted(() => ({ createWorkerProcess: vi.fn() }))
vi.mock('../../nativeBindingAnalysis/workerProcess', () => ({ createWorkerProcess }))

it('adapts SFC timing requests to the shared owned-process transport with native analysis disabled', async () => {
  const ready = { id: 0, kind: 'ready', sourceHashes: { compiler: 'digest' } }
  const sample: ScriptTimingSample = { output: '{}', inputSha256: 'input-digest', failed: false, metrics: {}, wallMs: 1, cpuMicroseconds: 2, rssAfterBytes: 3 }
  const compile = vi.fn().mockResolvedValue(sample)
  const close = vi.fn().mockResolvedValue(undefined)
  createWorkerProcess.mockResolvedValue({ ready, compile, close })
  const worker = await createScriptTimingProcess('optimized')
  expect(createWorkerProcess).toHaveBeenCalledExactlyOnceWith({
    worker: new URL('./worker.ts', import.meta.url),
    args: ['optimized'],
    label: 'Script compiler optimized',
    env: { WEAPP_VITE_NATIVE: '0' },
  })
  expect(worker.ready).toBe(ready)
  const scenario: ScriptTimingScenario = { id: 'sfc', kind: 'sfc', source: '<template><view /></template>', filename: 'page.vue', options: {} }
  await expect(worker.compile(scenario)).resolves.toBe(sample)
  expect(compile).toHaveBeenCalledExactlyOnceWith({ scenario })
  await worker.close()
  expect(close).toHaveBeenCalledOnce()
})
