import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { setTimeout } from 'node:timers/promises'

interface BenchmarkInitialOutput {
  filename: string
  label: string
}

/** 等待初次构建的全部计划产物可读，不能因 app.json 先写出而遗漏场景。 */
export async function waitForBenchmarkInitialOutputs(
  outputs: BenchmarkInitialOutput[],
  options: { timeoutMs: number, intervalMs?: number },
) {
  if (!outputs.length) {
    throw new Error('Benchmark initial output plan must not be empty.')
  }
  const deadline = performance.now() + options.timeoutMs
  let missing = outputs.map(output => output.label)
  while (performance.now() < deadline) {
    const observations = await Promise.all(outputs.map(async (output) => {
      try {
        await readFile(output.filename)
        return undefined
      }
      catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code === 'ENOENT') {
          return output.label
        }
        throw new Error(`Cannot read initial benchmark output ${output.label}: ${code ?? 'unknown'}`)
      }
    }))
    missing = observations.filter((label): label is string => label !== undefined)
    if (!missing.length && performance.now() < deadline) {
      return
    }
    const remaining = deadline - performance.now()
    if (remaining > 0) {
      await setTimeout(Math.min(options.intervalMs ?? 25, remaining))
    }
  }
  throw new Error(`Timed out waiting for initial benchmark outputs: ${missing.join(', ')}`)
}
