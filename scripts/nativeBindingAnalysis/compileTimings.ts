import process from 'node:process'
import { collectCompileTimings } from './compileTimings/runner'

/** 先验证全部语义，再串行采集两批完整编译诊断；入口不构建或猜测绑定文件名。 */
async function main() {
  const argumentsByName = new Map<string, string>()
  for (const argument of process.argv.slice(2)) {
    const match = /^--(binding-dir|output|iterations)=(.+)$/.exec(argument)
    if (!match || argumentsByName.has(match[1]!)) {
      throw new Error('Expected --binding-dir=<feature-built directory> --output=<new directory> [--iterations=<positive multiple of 10; default 40>]')
    }
    argumentsByName.set(match[1]!, match[2]!)
  }
  const bindingDirectory = argumentsByName.get('binding-dir')
  const output = argumentsByName.get('output')
  if (!bindingDirectory || !output) {
    throw new Error('Both --binding-dir and --output are required')
  }
  const result = await collectCompileTimings({ bindingDirectory, output, iterations: Number(argumentsByName.get('iterations') ?? '40') })
  console.log(JSON.stringify({ passed: result.passed, reports: result.sources.length, failedRun: result.failedRun, failure: result.failure, productionAcceptance: 'not-evaluated' }))
  if (!result.passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Compiler timing collection failed')
  process.exitCode = 1
})
