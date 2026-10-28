import { expect, it } from 'vitest'
import { createNativeWatcherFixture } from './nativeWatcher/fixture'
import { assertSharedNativeParent } from './sharedInode.mjs'

function observation(persistent: boolean) {
  const context = createNativeWatcherFixture()
  return { ...context, record: Object.assign(context.record, { path: '.', persistent, recursive: false }) }
}

function complete(context: ReturnType<typeof observation>) {
  context.native.close()
  context.handle.complete()
}

it('retains the exact live parent while requiring terminal evidence for every owned helper', async () => {
  const parent = observation(true)
  const first = observation(false)
  const second = observation(false)
  complete(first)
  complete(second)
  const instrumentation = { actualPlatform: 'darwin', handles: [parent.record, first.record, second.record] }
  await expect(assertSharedNativeParent({ instrumentation, parentPath: '.', timeoutMs: 100, expected: parent.record })).resolves.toBe(parent.record)
  expect(parent.record.closeCalls).toBe(0)
})

it('rejects a historical persistent rebind even when exactly one replacement remains live', async () => {
  const original = observation(true)
  const replacement = observation(true)
  complete(original)
  const instrumentation = { actualPlatform: 'darwin', handles: [original.record, replacement.record] }
  await expect(assertSharedNativeParent({ instrumentation, parentPath: '.', timeoutMs: 100, expected: original.record })).rejects.toThrow('historical persistent parent')
})

it('rejects a helper error termination even when it has one later public close call', async () => {
  const parent = observation(true)
  const helper = observation(false)
  helper.errorClose()
  helper.native.close()
  helper.handle.complete()
  const instrumentation = { actualPlatform: 'darwin', handles: [parent.record, helper.record] }
  await expect(assertSharedNativeParent({ instrumentation, parentPath: '.', timeoutMs: 100, expected: parent.record })).rejects.toThrow('public close event')
})

it('rejects extra helper resources outside the actual Darwin branch', async () => {
  const parent = observation(true)
  const helper = observation(false)
  complete(helper)
  const instrumentation = { actualPlatform: 'linux', handles: [parent.record, helper.record] }
  await expect(assertSharedNativeParent({ instrumentation, parentPath: '.', timeoutMs: 100, expected: parent.record })).rejects.toThrow('actual Darwin')
})

it('rechecks persistent history after awaiting exact helper completion', async () => {
  const parent = observation(true)
  const helper = observation(false)
  const replacement = observation(true)
  helper.native.close()
  const instrumentation = { actualPlatform: 'darwin', handles: [parent.record, helper.record] }
  const checking = assertSharedNativeParent({ instrumentation, parentPath: '.', timeoutMs: 100, expected: parent.record })
  instrumentation.handles.push(replacement.record)
  helper.handle.complete()
  await expect(checking).rejects.toThrow('persistent-parent rebind')
})
