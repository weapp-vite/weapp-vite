import type { TimingCorpus } from './timing/types'
import process from 'node:process'
import { runScriptTiming } from './timing/run'

/** 独立语料入口供串行采集器调用，失败时保留报告。 */
async function main() {
  const args = new Map<string, string>()
  for (const value of process.argv.slice(2)) {
    const match = /^--(scenario|batch|iterations|output)=(.+)$/.exec(value)
    if (!match || args.has(match[1]!)) {
      throw new Error('Expected --scenario=<corpus> --batch=<1|2> --iterations=<multiple of 14> --output=<new directory>')
    }
    args.set(match[1]!, match[2]!)
  }
  if (!args.get('output') || !args.get('scenario')) {
    throw new Error('Both output and scenario are required')
  }
  const report = await runScriptTiming({ scenario: args.get('scenario') as TimingCorpus, batch: Number(args.get('batch')), iterations: Number(args.get('iterations')), output: args.get('output')! })
  console.log(JSON.stringify({ passed: report.passed, pairs: report.completedPairs, failure: report.failure, cleanupErrors: report.cleanupErrors }))
  if (!report.passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
