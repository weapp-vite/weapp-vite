import process from 'node:process'
import { parseArgs } from 'node:util'
import { main } from '../cli.ts'

const { values } = parseArgs({ options: { root: { type: 'string' }, head: { type: 'string' }, base: { type: 'string' }, output: { type: 'string' }, jobs: { type: 'string' } } })
if (!values.root || !values.head || !values.output) {
  throw new Error('候选快照 worker 缺少冻结身份')
}
const args = ['run', '--mode', 'quick', '--selection', 'affected', '--head', values.head, '--output', values.output]
if (values.base) {
  args.push('--base', values.base)
}
if (values.jobs) {
  args.push('--jobs', values.jobs)
}
main(args, values.root).then(code => process.exitCode = code).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
