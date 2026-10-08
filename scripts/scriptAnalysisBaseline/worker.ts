import type { ScriptCheck, ScriptVariant, ScriptWorkerReport } from './types'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { createScriptExecution } from './execution'
import { scriptScenarios } from './scenarios'
import { SCRIPT_VARIANTS } from './types'

/** 每个实现独占新进程；只比较正确性与实际覆盖计数，不收集耗时。 */
async function main() {
  const variant = process.argv[2] as ScriptVariant
  const output = process.argv[3]
  if (!SCRIPT_VARIANTS.includes(variant) || !output) {
    throw new Error('Expected <script variant> <new output file>')
  }
  const execution = await createScriptExecution(variant)
  const checks: ScriptCheck[] = []
  try {
    for (const scenario of await scriptScenarios()) {
      for (let iteration = 0; iteration < 2; iteration++) {
        checks.push({
          scenario: scenario.id,
          iteration,
          ...await execution.execute(scenario),
        })
      }
    }
    const report: ScriptWorkerReport = { variant, sourceHashes: execution.sourceHashes, checks }
    await writeFile(output, `${JSON.stringify(report)}\n`, { flag: 'wx' })
  }
  finally {
    execution.dispose()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
