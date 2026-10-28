import { Buffer } from 'node:buffer'
import path from 'node:path'
import process from 'node:process'
import { expect, it } from 'vitest'
import { bounded, withNativeRegistrationFixture } from './nativeRegistration/fixture'

const darwin = it.skipIf(process.platform !== 'darwin')
const updated = '{"value":"the only update is deliberately larger than the initial file"}'
const updatedSize = Buffer.byteLength(updated)

darwin('delivers the sole write immediately after ready with directory resources and one bounded native helper', async () => {
  await withNativeRegistrationFixture(async ({ root, source, prepare, open }) => {
    const target = await prepare('quiet-0/entry-0.json')
    for (let index = 1; index < 120; index++) {
      await prepare(`quiet-${index % 4}/entry-${index}.json`)
    }
    const owner = open(root)
    await owner.ready()
    expect(owner.raw).toEqual([])
    const delivered = owner.change(target, updatedSize)
    source.write(target, updated)
    await delivered
    await owner.settle()
    expect(owner.changes).toEqual([target])
    expect(owner.raw).toHaveLength(1)
    expect(owner.errors).toEqual([])
    expect(source.fileHandles).toHaveLength(0)
    expect(source.peakLive).toBeLessThanOrEqual(6)
    expect(source.peakExtraDirectories).toBeLessThanOrEqual(1)
    expect(source.live.every(handle => handle.directory && handle.armed)).toBe(true)
    await owner.watcher.close()
    await owner.watcher.close()
    expect(source.live).toEqual([])
    expect(source.handles.every(handle => handle.closeCalls === 1)).toBe(true)
  })
})

darwin.each(['native', 'auto'] as const)('recovers a live %s owner when another owner registers during a shared native stream gap', async (backend) => {
  await withNativeRegistrationFixture(async ({ source, prepare, open, root }) => {
    const target = await prepare('survivor/entry.json')
    await prepare('new-owner/entry.json')
    const survivor = open(path.dirname(target), { backend })
    await survivor.ready()
    const delivered = survivor.change(target, updatedSize)
    source.duringNextRebuild(() => source.write(target, updated))
    const sibling = open(path.join(root, 'new-owner'))
    await sibling.ready()
    await delivered
    await survivor.settle()
    expect(source.gapWrites).toEqual([target])
    expect(survivor.changes).toEqual([target])
    expect(survivor.errors).toEqual([])
    expect(sibling.errors).toEqual([])
    expect(source.fileHandles).toHaveLength(0)
    expect(survivor.readyCount).toBe(1)
  })
})

darwin('recovers every surviving owner when a sibling closes without closing or borrowing the surviving native handle', async () => {
  await withNativeRegistrationFixture(async ({ source, prepare, open, root }) => {
    const target = await prepare('survivor/entry.json')
    await prepare('closing/entry.json')
    const survivor = open(path.dirname(target))
    const sibling = open(path.join(root, 'closing'))
    await Promise.all([survivor.ready(), sibling.ready()])
    const survivorHandle = await bounded(source.registered(path.dirname(target)), 'surviving native directory')
    const delivered = survivor.change(target, updatedSize)
    source.duringNextRebuild(() => source.write(target, updated))
    await sibling.watcher.close()
    await delivered
    await survivor.settle()
    expect(source.gapWrites).toEqual([target])
    expect(survivor.changes).toEqual([target])
    expect(survivorHandle.live).toBe(true)
    expect(survivorHandle.closeCalls).toBe(0)
    expect(survivor.errors).toEqual([])
    expect(source.fileHandles).toHaveLength(0)
  })
})

darwin('preserves finite depth and ignored paths while arming the accepted directory', async () => {
  await withNativeRegistrationFixture(async ({ root, source, prepare, open }) => {
    const target = await prepare('entry.json')
    const ignored = await prepare('ignored.json')
    const deep = await prepare('child/deep.json')
    const owner = open(root, { depth: 0, ignored: /ignored\.json$/ })
    await owner.ready()
    const delivered = owner.change(target, updatedSize)
    source.write(ignored, updated)
    source.write(deep, updated)
    source.write(target, updated)
    await delivered
    await owner.settle()
    expect(owner.changes).toEqual([target])
    expect(source.fileHandles).toHaveLength(0)
    expect(source.handles.some(handle => handle.file === path.dirname(deep))).toBe(false)
    expect(source.peakLive).toBeLessThanOrEqual(2)
    expect(owner.errors).toEqual([])
  })
})

darwin('retains the original stream-start failure when public ready reports that the initial scan finished', async () => {
  await withNativeRegistrationFixture(async ({ root, source, prepare, open }) => {
    await prepare('entry.json')
    const original = Object.assign(new Error('original FSEventStreamStart failure'), { code: 'EMFILE', syscall: 'watch' })
    source.rejectStreamStarts(original)
    const owner = open(root)
    const [, reported] = await Promise.all([owner.ready(), owner.error()])
    expect(reported).toBe(original)
    await owner.settle()
    expect(source.rebuilds.some(rebuild => rebuild.failed)).toBe(true)
    expect(owner.errors.includes(original)).toBe(true)
    expect(owner.readyCount).toBe(1)
  })
})

darwin('reports an original helper registration error without closing the existing directory owner', async () => {
  await withNativeRegistrationFixture(async ({ root, source, prepare, open }) => {
    await prepare('entry.json')
    const owner = open(root)
    const initial = await bounded(source.registered(root), 'existing directory before helper registration')
    const original = Object.assign(new Error('original helper registration failure'), { code: 'EMFILE', syscall: 'watch' })
    source.rejectNextDirectoryRegistration(original)
    const [, reported] = await Promise.all([owner.ready(), owner.error()])
    expect(reported).toBe(original)
    await owner.settle()
    expect(source.registrationFailures).toHaveLength(1)
    expect(source.registrationFailures[0]?.file).toBe(root)
    expect(source.registrationFailures[0]?.error).toBe(original)
    expect(owner.errors).toEqual([original])
    expect(owner.readyCount).toBe(1)
    expect(owner.raw).toHaveLength(0)
    expect(source.fileHandles).toHaveLength(0)
    expect(initial.live).toBe(true)
    expect(initial.closeCalls).toBe(0)
    await owner.watcher.close()
    expect(source.live).toHaveLength(0)
    expect(source.handles.every(handle => handle.closeCalls === 1)).toBe(true)
  })
})

darwin('does not publish ready or late native changes after close during initial registration', async () => {
  await withNativeRegistrationFixture(async ({ root, source, prepare, open }) => {
    const target = await prepare('entry.json')
    const owner = open(root)
    const initial = await bounded(source.registered(root), 'initial directory registration')
    await owner.watcher.close()
    source.write(target, updated)
    source.deliverLate(initial, target)
    await owner.settle()
    expect(owner.readyCount).toBe(0)
    expect(owner.changes).toEqual([])
    expect(source.live).toEqual([])
    expect(source.handles.every(handle => handle.closeCalls === 1)).toBe(true)
  })
})

darwin('rearms a new unwatch/add generation and rejects a callback captured by its retired directory handle', async () => {
  await withNativeRegistrationFixture(async ({ root, source, prepare, open }) => {
    const target = await prepare('entry.json')
    const owner = open(root)
    await owner.ready()
    const initial = await bounded(source.registered(root), 'initial directory generation')
    owner.watcher.unwatch(root)
    owner.watcher.add(root)
    const replacement = await bounded(source.registered(root, initial), 'replacement directory generation')
    await owner.settle()
    expect(replacement.armed).toBe(true)
    expect(initial.live).toBe(false)
    source.deliverLate(initial, target)
    const delivered = owner.change(target, updatedSize)
    source.write(target, updated)
    await delivered
    await owner.settle()
    expect(owner.changes).toEqual([target])
    expect(owner.errors).toEqual([])
    expect(owner.readyCount).toBe(1)
    expect(source.fileHandles).toHaveLength(0)
  })
})

darwin('keeps an unrelated native owner open across its own registration, recovery and teardown', async () => {
  await withNativeRegistrationFixture(async ({ root, source, prepare, open }) => {
    const target = await prepare('entry.json')
    const observed: string[] = []
    const unrelated = source.watch(root, { persistent: true }, (_event, name) => observed.push(String(name)))
    try {
      const owner = open(root)
      await owner.ready()
      const delivered = owner.change(target, updatedSize)
      source.write(target, updated)
      await delivered
      await owner.watcher.close()
      expect(unrelated.live).toBe(true)
      expect(unrelated.closeCalls).toBe(0)
      expect(observed).toEqual(['entry.json'])
      expect(source.fileHandles).toHaveLength(0)
    }
    finally {
      unrelated.close()
    }
  })
})
