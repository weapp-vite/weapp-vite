import process from 'node:process'
import { collectScriptTimings } from './timing/collect'

/** 显式启动两批完整编译测量；不自动构建、不重试失败批次。 */
async function main() {
  const args = new Map<string, string>()
  for (const value of process.argv.slice(2)) {
    const match = /^--(output|iterations)=(.+)$/.exec(value)
    if (!match || args.has(match[1]!)) {
      throw new Error('Expected --output=<new directory> [--iterations=<positive multiple of 14; default 42>]')
    }
    args.set(match[1]!, match[2]!)
  }
  const output = args.get('output')
  if (!output) {
    throw new Error('Output directory is required')
  }
  const result = await collectScriptTimings({ output, iterations: Number(args.get('iterations') ?? '42') })
  console.log(JSON.stringify({ passed: result.passed, failedRun: result.failedRun, failure: result.failure }))
  if (!result.passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
