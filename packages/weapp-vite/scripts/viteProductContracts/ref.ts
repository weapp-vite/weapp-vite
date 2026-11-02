import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 进程存活契约必须观察独立 Node 退出，复用跨平台启动与超时收尾。
import { execa } from 'execa'
import { fixture } from './support'

/** 验证公开 ref/unref 的实际退出语义，不使用另一个引用句柄替 watcher 保活。 */
export async function watcherReference() {
  await fixture({ 'package.json': '{"type":"module"}', 'control.txt': 'initial' }, async (root) => {
    const worker = fileURLToPath(new URL('./refWorker.ts', import.meta.url))
    const child = execa(process.execPath, ['--import', 'tsx', worker, root], { timeout: 15_000 })
    let held = false
    let output = ''
    let mutation: Promise<void> | undefined
    child.stdout?.on('data', (data) => {
      output += String(data)
      if (!held && output.includes('watcher-kept-process-alive')) {
        held = true
        mutation = writeFile(path.join(root, 'control.txt'), 'unreference the watcher owner')
        // 子进程结算后仍会等待并重抛同一写入错误。
        void mutation.catch(() => {})
      }
    })
    let failure: { error: unknown } | undefined
    try {
      const result = await child
      assert.equal(result.exitCode, 0)
      assert.ok(held, 'Referenced product watcher must keep an otherwise idle process alive')
      assert.ok(result.stdout.includes('watcher-unreferenced'), 'The control save must unreference the watcher before natural exit')
    }
    catch (error) {
      failure = { error }
    }
    const errors: unknown[] = failure ? [failure.error] : []
    try {
      await mutation
    }
    catch (error) {
      errors.push(error)
    }
    if (errors.length) {
      throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Watcher process and control mutation failed', { cause: errors[0] })
    }
  })
}
