import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { expect, it, vi } from 'vitest'
import { bounded, deferred, withFixture } from './firstNativeWrite/fixture'

// 此处验证目录回调的行为语义；注册握手、资源上界与共享 owner 由 nativeRegistration.test.ts 覆盖。
it.skipIf(process.platform !== 'darwin').each(['file', 'directory'] as const)('observes the first existing-file write through watch(%s) after its named directory callback', async (scope) => {
  await withFixture(scope, async ({ file, root, watcher, changes, deliver }) => {
    await writeFile(file, '{"desc":"changed with a distinct size"}')
    deliver(root, path.basename(file))
    await bounded(watcher.lifecycle.drain(), 'first named directory callback')
    expect(changes).toEqual(['sitemap.json'])
  })
})

it.skipIf(process.platform !== 'darwin')('recovers the first existing-file write when only an unrelated directory callback arrives later', async () => {
  await withFixture('directory', async ({ file, root, watcher, changes, deliver }) => {
    await writeFile(file, '{"desc":"changed with a distinct size"}')
    // 本次写入没有同名回调；稍后的目录回调只命名被忽略且未改动的文件。
    deliver(root, 'unrelated.js')
    await bounded(watcher.lifecycle.drain(), 'first unrelated directory callback')
    expect(changes).toEqual(['sitemap.json'])
  })
})

it.skipIf(process.platform !== 'darwin')('does not let an unchanged directory callback hide a subsequent real write', async () => {
  await withFixture('directory', async ({ file, root, watcher, changes, deliver }) => {
    deliver(root, path.basename(file))
    await bounded(watcher.lifecycle.drain(), 'unchanged named callback')
    expect(changes).toEqual([])
    await writeFile(file, '{"desc":"the real write still reaches the directory owner"}')
    deliver(root, path.basename(file))
    await bounded(watcher.lifecycle.drain(), 'later changed named callback')
    expect(changes).toEqual(['sitemap.json'])
  })
})

it.skipIf(process.platform !== 'darwin')('preserves ignored files and discovers later files through directory callbacks', async () => {
  await withFixture('directory', async ({ root, watcher, changes, deliver }) => {
    expect(watcher.getWatched()[root]).not.toContain('unrelated.js')
    deliver(root, 'unrelated.js')
    await bounded(watcher.lifecycle.drain(), 'ignored directory callback')
    expect(changes).toEqual([])
    const later = path.join(root, 'later.json')
    await writeFile(later, '{"later":true}')
    deliver(root, 'later.json', 'rename')
    await bounded(watcher.lifecycle.drain(), 'later file creation')
    expect(watcher.getWatched()[root]).toContain('later.json')
    await writeFile(later, '{"later":"the subsequent write remains observable"}')
    deliver(root, 'later.json')
    await bounded(watcher.lifecycle.drain(), 'later file modification')
    expect(changes).toEqual(['later.json'])
  })
})

it.skipIf(process.platform !== 'darwin')('retries the first directory recovery after a warned scan and observes a later unnamed write', async () => {
  await withFixture('directory', async ({ file, root, watcher, changes, deliver }) => {
    const createScanStream = watcher.createScanStream.bind(watcher)
    const observation = vi.spyOn(watcher, 'createScanStream').mockImplementationOnce((...args) => {
      const stream = createScanStream(...args)
      queueMicrotask(() => stream?.emit('warn', Object.assign(new Error('transient child stat failure'), { code: 'EACCES' })))
      return stream
    })
    try {
      deliver(root, 'unrelated.js')
      await bounded(watcher.lifecycle.drain(), 'warned directory recovery')
      expect(observation).toHaveBeenCalledTimes(1)
      expect(changes).toEqual([])
      await writeFile(file, '{"desc":"changed after the incomplete recovery scan"}')
      deliver(root, 'ignored-again.js')
      await bounded(watcher.lifecycle.drain(), 'complete directory recovery after warning')
      expect(observation).toHaveBeenCalledTimes(2)
      expect(changes).toEqual(['sitemap.json'])
    }
    finally {
      observation.mockRestore()
    }
  }, { initialFiles: ['ignored-again.js'] })
})

it.skipIf(process.platform !== 'darwin')('does not repeat a recovered write during later full rescans or its delayed named callback', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    await withFixture('directory', async ({ file, root, watcher, changes, deliver }) => {
      await writeFile(file, '{"desc":"changed with a distinct size"}')
      deliver(root, 'unrelated.js')
      await bounded(watcher.lifecycle.drain(), 'first callback recovery')
      expect(changes).toEqual(['sitemap.json'])
      await vi.advanceTimersByTimeAsync(1000)
      deliver(root, null)
      await bounded(watcher.lifecycle.drain(), 'later full rescan')
      deliver(root, path.basename(file), 'rename')
      await bounded(watcher.lifecycle.drain(), 'delayed named callback')
      expect(changes).toEqual(['sitemap.json'])
      deliver(root, path.basename(file), 'change')
      await bounded(watcher.lifecycle.drain(), 'delayed named change after rename')
      expect(changes).toEqual(['sitemap.json'])
      deliver(root, path.basename(file), 'rename')
      await bounded(watcher.lifecycle.drain(), 'second delayed named rename')
      expect(changes).toEqual(['sitemap.json'])
      await writeFile(file, '{"desc":"a subsequent write still reaches the original directory owner"}')
      deliver(root, path.basename(file))
      await bounded(watcher.lifecycle.drain(), 'subsequent real write')
      expect(changes).toEqual(['sitemap.json', 'sitemap.json'])
    })
  }
  finally {
    vi.useRealTimers()
  }
})

it.skipIf(process.platform !== 'darwin')('commits a named directory callback accepted while the first recovery scan was completing', async () => {
  await withFixture('directory', async ({ file, root, watcher, changes, deliver }) => {
    const scanned = deferred()
    const resume = deferred()
    const readDirectory = watcher.handler.readDirectory.bind(watcher.handler)
    const observation = vi.spyOn(watcher.handler, 'readDirectory').mockImplementationOnce(async (...args) => {
      const result = await readDirectory(...args)
      scanned.resolve()
      await resume.promise
      return result
    })
    try {
      deliver(root, 'unrelated.js')
      await bounded(scanned.promise, 'directory scan before the concurrent write')
      await writeFile(file, '{"desc":"changed after its recovery stat was already read"}')
      deliver(root, path.basename(file))
      resume.resolve()
      await bounded(watcher.lifecycle.drain(), 'callback queued during directory recovery')
      expect(changes).toEqual(['sitemap.json'])
    }
    finally {
      resume.resolve()
      observation.mockRestore()
    }
  })
})

it.skipIf(process.platform !== 'darwin').each(['close', 'unwatch'] as const)('discards an accepted directory reconciliation after %s', async (action) => {
  await withFixture('directory', async ({ file, root, watcher, changes, resources, deliver }) => {
    const entered = deferred()
    const resume = deferred()
    const reconcile = watcher.handler.reconcileNativeTrigger.bind(watcher.handler)
    const observation = vi.spyOn(watcher.handler, 'reconcileNativeTrigger').mockImplementationOnce(async (...args) => {
      entered.resolve()
      await resume.promise
      return reconcile(...args)
    })
    let closing: Promise<void> | undefined
    try {
      await writeFile(file, '{"desc":"changed with a distinct size"}')
      deliver(root, path.basename(file))
      await bounded(entered.promise, 'accepted directory reconciliation')
      if (action === 'close') {
        closing = watcher.close()
        expect(watcher.close()).toBe(closing)
        let complete = false
        void closing.then(() => {
          complete = true
        }, () => {})
        await Promise.resolve()
        expect(complete).toBe(false)
        expect(resources()).toEqual([])
      }
      else {
        watcher.unwatch(file)
        expect(watcher.getWatched()[root]).not.toContain('sitemap.json')
      }
      resume.resolve()
      if (closing) {
        await bounded(closing, 'close after accepted callback')
      }
      await bounded(watcher.lifecycle.drain(), 'cancelled directory reconciliation')
      deliver(root, path.basename(file), 'change', true)
      await bounded(watcher.lifecycle.drain(), 'late directory callback after cancellation')
      expect(changes).toEqual([])
    }
    finally {
      resume.resolve()
      observation.mockRestore()
      if (closing) {
        await bounded(closing, 'cancelled close cleanup')
      }
    }
  })
})
