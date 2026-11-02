import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runWithCleanup } from '../runWithCleanup'

interface InspectorChild<T> extends PromiseLike<T> {
  nodeChildProcess?: ChildProcess
}

/** 持有原生 close 回执后才允许删除本次可执行文件；取消不会提前解除所有权。 */
export async function withWindowsInspectorDirectory<T>(operation: (directory: string, settle: <R>(child: InspectorChild<R>) => Promise<R>) => Promise<T>): Promise<T> {
  const directory = await fs.mkdtemp(join(tmpdir(), 'weapp-dev-process-'))
  const pending = new Set<Promise<void>>()
  let unconfirmedChild = false
  const settle = async <R>(subprocess: InspectorChild<R>): Promise<R> => {
    const child = subprocess.nodeChildProcess
    if (!child) {
      unconfirmedChild = true
      throw new Error('Windows kernel inspector did not expose its owned native child handle.')
    }
    const closed = Promise.withResolvers<void>()
    const onClose = () => closed.resolve()
    child.once('close', onClose)
    pending.add(closed.promise)
    try {
      return await subprocess
    }
    finally {
      // Execa 的超时/取消只请求终止；原生 close 和 stdio 排空仍须独立等到。
      await closed.promise
      pending.delete(closed.promise)
      child.removeListener('close', onClose)
    }
  }
  return runWithCleanup(() => operation(directory, settle), async () => {
    if (unconfirmedChild) {
      throw new Error(`Windows kernel inspector directory retained because its child identity is unconfirmed: ${directory}`)
    }
    await Promise.all(pending)
    await fs.rm(directory, { recursive: true, force: true })
  })
}
