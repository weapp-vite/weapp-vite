import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { verifyPush } from './run.ts'

const { values, positionals } = parseArgs({ allowPositionals: true, options: { base: { type: 'string' }, jobs: { type: 'string' } } })
// pnpm 会保留显式的 --，Git 的 remote URL 只用于原生参数完整性，不写入报告。
const remote = positionals.filter(value => value !== '--')
if (remote.length !== 2 || !remote[0] || !remote[1] || process.stdin.isTTY) {
  throw new Error('verify:push 只能从 Git pre-push 原生参数与 stdin 执行')
}
const controller = new AbortController()
function abort() {
  controller.abort()
  process.stdin.destroy()
}
process.once('SIGINT', abort)
process.once('SIGTERM', abort)
try {
  process.stdin.setEncoding('utf8')
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
    if (input.length > 1024 * 1024) {
      throw new Error('pre-push 引用输入超出上限')
    }
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
  await verifyPush(root, input, { base: values.base, jobs: values.jobs, signal: controller.signal })
}
catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = controller.signal.aborted ? 130 : 1
}
finally {
  process.removeListener('SIGINT', abort)
  process.removeListener('SIGTERM', abort)
}
