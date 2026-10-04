import type { ScriptTimingSample, ScriptTimingScenario } from './protocol'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { SCRIPT_VARIANTS } from '../types'
import { createScriptTimingProcess } from './process'

const success: ScriptTimingScenario = {
  id: 'ipc-smoke-success',
  kind: 'sfc',
  filename: 'src/components/ipc-smoke.vue',
  source: `<script setup lang="ts">
const props = defineProps<{ title: string }>()
</script><template><view>{{ props.title }}</view></template>`,
  options: { sourceMap: true },
}
const failure: ScriptTimingScenario = {
  ...success,
  id: 'ipc-smoke-error',
  source: '<script setup lang="ts">const =</script><template><view /></template>',
}

function assertContract(sample: ScriptTimingSample, scenario: ScriptTimingScenario, failed: boolean) {
  expect(sample.inputSha256).toBe(createHash('sha256').update(JSON.stringify(scenario)).digest('hex'))
  expect(sample.failed).toBe(failed)
  expect(sample.metrics.activeCompiles ?? 0).toBe(0)
  expect(sample.metrics.pendingTransfers ?? 0).toBe(0)
  expect(sample.metrics.astAlreadyConsumed ?? 0).toBe(0)
}

// 真实 IPC 仅用于正确性；七个 worker 串行创建与释放，不保留或汇总任何耗时、CPU、RSS。
it('keeps complete outputs stable across seven real workers, repeated calls and recovery after compilation errors', async () => {
  let expectedSuccess: string | undefined
  let expectedFailure: string | undefined
  let expectedSources: Record<string, string> | undefined
  for (const variant of SCRIPT_VARIANTS) {
    const worker = await createScriptTimingProcess(variant)
    try {
      if (variant === 'baseline') {
        expect(worker.ready.sourceHashes).toEqual({})
      }
      else {
        expectedSources ??= worker.ready.sourceHashes
        expect(Object.keys(worker.ready.sourceHashes)).toHaveLength(6)
        expect(worker.ready.sourceHashes).toEqual(expectedSources)
      }
      for (let iteration = 0; iteration < 2; iteration++) {
        const result = await worker.compile(success)
        assertContract(result, success, false)
        const output: unknown = JSON.parse(result.output)
        expect(output).toMatchObject({ value: { script: expect.any(String), template: expect.any(String), scriptMap: expect.any(Object) }, warnings: [], consoleWarnings: [] })
        expectedSuccess ??= result.output
        expect(result.output).toBe(expectedSuccess)
      }
      const error = await worker.compile(failure)
      assertContract(error, failure, true)
      expectedFailure ??= error.output
      expect(error.output).toBe(expectedFailure)
      const recovered = await worker.compile(success)
      assertContract(recovered, success, false)
      expect(recovered.output).toBe(expectedSuccess)
    }
    finally {
      await worker.close()
    }
    await worker.close()
  }
}, 180_000)
