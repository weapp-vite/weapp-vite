import type { FSWatcher } from 'node:fs'
import { watch } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { constants, tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { assertNativeWatcherClosed, observeNativeWatcher } from './nativeWatcher.mjs'

function bounded<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Native watcher unit fixture cleanup did not complete')), 2000)
    }),
  ]).finally(() => clearTimeout(timer))
}

it.each(['public-close', 'injected-node-error'] as const)('observes actual FSEvent completion for %s without a machine lease or IDE', async (kind) => {
  const root = await mkdtemp(path.join(tmpdir(), 'native-watcher-unit-'))
  let native: FSWatcher | undefined
  let record: ReturnType<typeof observeNativeWatcher> | undefined
  try {
    const file = path.join(root, 'owned.txt')
    await writeFile(file, 'only this unit fixture owns the native watcher')
    native = watch(file, { persistent: false, recursive: false }, () => {})
    record = observeNativeWatcher(native, { path: 'owned.txt', afterPublicClose: false })
    if (kind === 'public-close') {
      native.close()
    }
    else {
      // 只注入当前 Node 的真实错误分支；这不是 Windows 原生文件删除事件或 Windows CI 证据。
      const watcher = native as FSWatcher & { _handle: { onchange: (status: number, event: string, filename: string) => void } }
      watcher._handle.onchange(-constants.errno.EPERM, 'rename', file)
    }
    await bounded(record.closePromise)
    expect(record).toMatchObject({
      closed: true,
      nativeCloseRequests: 1,
      nativeCloseCompletions: 1,
      closeEvents: kind === 'public-close' ? 1 : 0,
      errorEvents: kind === 'public-close' ? 0 : 1,
    })
    expect(() => assertNativeWatcherClosed(record, kind === 'public-close')).not.toThrow()
  }
  finally {
    if (native) {
      native.close()
      await bounded(record!.closePromise)
    }
    await rm(root, { recursive: true, force: true })
  }
})
