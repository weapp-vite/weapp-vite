import type { PreparedDarwinInspector } from '../types'
import process from 'node:process'
import { withDarwinInspector } from '../reader'

// 只由 native.test.ts 以独立 runner 执行，用真实退出信号验证默认子进程清理。
async function runNativeOwnerFixture() {
  const prepared = JSON.parse(process.argv[2]!) as PreparedDarwinInspector
  await withDarwinInspector(Date.now() + 10_000, async (reader) => {
    await reader.readFrame('prepare')
    const anchor = await reader.readFrame('anchor')
    process.stdout.write(`${JSON.stringify({ pid: anchor.ownedHelper.pid })}\n`)
    await new Promise<never>(() => {})
  }, prepared)
}

runNativeOwnerFixture().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
