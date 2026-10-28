import assert from 'node:assert/strict'
import { readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertNativeWatcherClosed } from './nativeWatcher.mjs'
import { bounded, turn, waitForObservedEventPhase } from './support.mjs'

/** 共享父资源保持同一存活身份；额外目录 helper 必须各自公开关闭并完成原生终结。 */
export async function assertSharedNativeParent({ instrumentation, parentPath, timeoutMs, expected }) {
  const parentHandles = instrumentation.handles.filter(handle => handle.path === parentPath)
  const persistent = parentHandles.filter(handle => handle.persistent === true)
  assert.equal(persistent.length, 1, 'shared owners retain exactly one historical persistent parent resource')
  const shared = persistent[0]
  if (expected) {
    assert.equal(shared, expected, 'inode replacement cannot rebind or replace the shared parent resource')
  }
  const helpers = instrumentation.handles.filter(handle => handle.persistent === false)
  if (helpers.length) {
    assert.equal(instrumentation.actualPlatform, 'darwin', 'extra directory helpers are only supported on actual Darwin')
  }
  for (const helper of helpers) {
    assert.equal(helper.path, parentPath, 'a helper can only acquire this scenario\'s shared parent directory')
    assert.equal(helper.recursive, false, 'a registration helper cannot acquire a recursive wrapper')
    assert.equal(helper.closeCalls, 1, 'every helper must already have received one public close')
    assert.equal(helper.nativeCloseRequests, 1, 'every helper must request its own native close once')
  }
  await bounded(Promise.all(helpers.map(helper => helper.closePromise)), 'all owned shared-parent helpers complete their exact native close', timeoutMs)
  for (const helper of helpers) {
    assertNativeWatcherClosed(helper, true)
  }
  const currentParentHandles = instrumentation.handles.filter(handle => handle.path === parentPath)
  const currentPersistent = currentParentHandles.filter(handle => handle.persistent === true)
  assert.equal(currentPersistent.length, 1, 'closed helpers cannot hide a historical persistent-parent rebind')
  assert.equal(currentPersistent[0], shared, 'the persistent parent identity cannot change while helpers finish')
  const live = currentParentHandles.filter(handle => !handle.closed)
  assert.equal(live.length, 1, 'exactly the original shared parent remains live')
  assert.equal(live[0], shared)
  assert.deepEqual(shared.observationErrors, [])
  assert.equal(shared.closed, false)
  assert.equal(shared.closeCalls, 0)
  assert.equal(shared.closeEvents, 0)
  assert.equal(shared.nativeCloseRequests, 0)
  assert.equal(shared.nativeCloseCompletions, 0)
  return shared
}

/** 两个 owner 直接 watch 同一个真实文件，共享 v6 的父目录资源。 */
export async function verifySharedInode({ chokidar, root, timeoutMs, open, ready, instrumentation, evidence }) {
  assert.ok(['darwin', 'linux', 'freebsd'].includes(instrumentation.actualPlatform), 'native inode contract requires POSIX inode-watch semantics')
  const file = path.join(root, 'shared-inode.txt')
  const replacement = path.join(root, 'replacement.tmp')
  await writeFile(file, 'first inode')
  const first = open(chokidar, file)
  await ready(first)
  const second = open(chokidar, file)
  await ready(second)
  const parentLabel = path.relative(root, path.dirname(file)).replaceAll('\\', '/') || '.'
  const oldHandle = await assertSharedNativeParent({ instrumentation, parentPath: parentLabel, timeoutMs })
  const before = await stat(file)
  await writeFile(replacement, 'replacement inode has a different size')
  const firstChanges = [first.event('change', file, timeoutMs), second.event('change', file, timeoutMs)]
  await rename(replacement, file)
  await Promise.all(firstChanges)
  const after = await stat(file)
  assert.notEqual(after.ino, before.ino, 'real rename replaced the watched inode')
  // 两个 change listener 的后续同步重绑语句在微任务后完成，不等待固定时间或重试变更。
  await turn()
  evidence.push({ checkpoint: 'real-shared-inode-replacement', oldInode: String(before.ino), newInode: String(after.ino), native: instrumentation.snapshot() })
  const nativeRebound = oldHandle.closeCalls === 0 && !oldHandle.closed
    && instrumentation.handles.filter(handle => handle.path === parentLabel && !handle.closed).length === 1
  const secondBoundary = instrumentation.handles.length
  for (const owner of [first, second]) {
    await waitForObservedEventPhase(owner, file, evidence, timeoutMs)
  }
  const subsequent = [first.event('change', file, timeoutMs), second.event('change', file, timeoutMs)]
  await writeFile(file, 'the new inode must report a subsequent real change to both direct owners')
  const outcomes = await Promise.allSettled(subsequent)
  evidence.push({
    checkpoint: 'next-real-change-for-both-owners',
    outcomes: outcomes.map(outcome => outcome.status === 'fulfilled'
      ? { status: outcome.status }
      : { status: outcome.status, reason: String(outcome.reason) }),
    nativeRebound,
    nativeAtSecondWrite: secondBoundary,
  })
  assert.ok(nativeRebound, 'one shared parent resource must cover both logical file generations')
  assert.ok(outcomes.every(outcome => outcome.status === 'fulfilled'), 'both owners must receive the next real change after inode replacement')
  assert.equal(await readFile(file, 'utf8'), 'the new inode must report a subsequent real change to both direct owners')
  await assertSharedNativeParent({ instrumentation, parentPath: parentLabel, timeoutMs, expected: oldHandle })
  for (const owner of [first, second]) {
    assert.deepEqual(owner.errors, [])
  }
}
