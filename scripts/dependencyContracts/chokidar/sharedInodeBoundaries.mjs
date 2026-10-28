import assert from 'node:assert/strict'
import { access, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertSharedNativeParent } from './sharedInode.mjs'
import { bounded, deferred, turn, waitForObservedEventPhase } from './support.mjs'

async function openDirectOwners({ chokidar, root, file, open, ready, instrumentation, timeoutMs }) {
  assert.ok(['darwin', 'linux', 'freebsd'].includes(instrumentation.actualPlatform))
  await writeFile(file, 'first shared boundary inode')
  const owners = [open(chokidar, file)]
  await ready(owners[0])
  owners.push(open(chokidar, file))
  await ready(owners[1])
  const parent = path.relative(root, path.dirname(file)).replaceAll('\\', '/') || '.'
  const oldHandle = await assertSharedNativeParent({ instrumentation, parentPath: parent, timeoutMs })
  return { owners, oldHandle, before: await stat(file) }
}

async function assertRebound({ instrumentation, oldHandle, timeoutMs }) {
  assert.equal(oldHandle.closeCalls, 0)
  assert.equal(oldHandle.closeEvents, 0)
  return assertSharedNativeParent({ instrumentation, parentPath: oldHandle.path, timeoutMs, expected: oldHandle })
}

function nextOwnerChange(owners, file, timeoutMs) {
  const changed = deferred()
  const listeners = owners.map((owner, index) => {
    const listener = (actual) => {
      if (path.resolve(String(actual)) === file) {
        changed.resolve(index)
      }
    }
    owner.watcher.on('change', listener)
    return listener
  })
  const awaited = bounded(changed.promise, 'the released sibling publishes its real file change', timeoutMs)
    .finally(() => owners.forEach((owner, index) => owner.watcher.off('change', listeners[index])))
  awaited.catch(() => {})
  return awaited
}

/** 同一原生代的两个 sibling stat 中，旧 ENOENT 迟到时不能移除已重绑的新 inode。 */
export async function verifyLateSiblingError(options) {
  const { root, file, timeoutMs, instrumentation, evidence, gate } = options
  const { owners, oldHandle, before } = await openDirectOwners(options)
  const replacement = path.join(root, 'late-sibling-replacement.tmp')
  const boundaries = owners.map(owner => owner.events.length)
  let releasedOriginalError = false
  try {
    gate.arm()
    await writeFile(file, 'one real native event starts both shared owner stat calls')
    await bounded(gate.pair, 'two shared-owner file stats reach their exact gates', timeoutMs)
    await bounded(gate.firstWaveClosed, 'the first synchronous stat dispatch completes', timeoutMs)
    assert.ok(gate.requests.length >= 2, 'the shared native parent schedules an independent reconciliation for each owner')
    assert.equal(oldHandle.closed, false)
    await writeFile(replacement, 'a distinct replacement inode exists while the old file is still present')
    assert.notEqual((await stat(replacement)).ino, before.ino)
    await rm(file)
    await assert.rejects(access(file), { code: 'ENOENT' })
    gate.run(0)
    await bounded(gate.requests[0].observed.promise, 'the old sibling obtains a real native ENOENT', timeoutMs)
    const heldError = gate.requests[0].nativeError
    assert.equal(heldError?.code, 'ENOENT')
    assert.equal(heldError?.syscall, 'lstat')
    assert.equal(path.resolve(String(heldError?.path)), file)
    assert.equal(gate.requests[0].deliveredError, undefined)
    await rename(replacement, file)
    const changedOwner = nextOwnerChange(owners, file, timeoutMs)
    gate.run(1)
    await bounded(gate.requests[1].observed.promise, 'the sibling reads the actual replacement inode', timeoutMs)
    const after = gate.requests[1].nativeStats
    assert.ok(after)
    assert.notEqual(after.ino, before.ino, 'the replacement has a distinct real inode')
    gate.deliver(1)
    const rebindOwner = await changedOwner
    await assertRebound({ ...options, oldHandle })
    assert.equal(gate.requests[0].deliveredError, undefined, 'the original native error remains held until the sibling rebind completes')
    const lateBoundary = owners.map(owner => owner.events.length)
    gate.deliver(0)
    await bounded(gate.requests[0].returned.promise, 'the original native error returns unchanged to the old sibling', timeoutMs)
    gate.releaseAll()
    await bounded(Promise.all(gate.requests.map(request => request.returned.promise)), 'all exact stat gates return after sibling rebinding', timeoutMs)
    await turn()
    releasedOriginalError = gate.requests[0].deliveredError === heldError
    assert.equal(releasedOriginalError, true)
    for (const [index, owner] of owners.entries()) {
      const ownEvents = owner.events.slice(lateBoundary[index]).filter(event => event.path === path.relative(root, file).replaceAll('\\', '/'))
      assert.equal(ownEvents.some(event => ['unlink', 'add'].includes(event.event)), false, 'a late sibling error cannot remove or rediscover the replacement file')
      assert.equal(owner.events.slice(boundaries[index]).some(event => ['unlink', 'add'].includes(event.event)), false)
      assert.deepEqual(owner.errors, [])
      await waitForObservedEventPhase(owner, file, evidence, timeoutMs)
    }
    const nextChanges = owners.map(owner => owner.event('change', file, timeoutMs))
    await writeFile(file, 'both direct owners still observe a real change after the old sibling ENOENT')
    await Promise.all(nextChanges)
    assert.equal(await readFile(file, 'utf8'), 'both direct owners still observe a real change after the old sibling ENOENT')
    await assertSharedNativeParent({ instrumentation, parentPath: oldHandle.path, timeoutMs, expected: oldHandle })
    evidence.push({ checkpoint: 'late-sibling-native-enoent-preserves-rebound-inode', rebindOwner, lateErrorOwner: 1 - rebindOwner, originalErrorPreserved: releasedOriginalError, firstDispatchRequests: 2, oldInode: String(before.ino), newInode: String(after.ino) })
  }
  finally {
    gate.releaseAll()
    evidence.push({ checkpoint: 'late-sibling-stat-gate-release', capturedRequests: gate.requests.length, originalErrorPreserved: releasedOriginalError })
  }
}

/** 共享原生句柄重绑后关闭一个 owner，幸存 owner 必须继续收到真实写入。 */
export async function verifyReboundSurvivor(options) {
  const { root, file, timeoutMs, instrumentation, evidence } = options
  const { owners: [closing, survivor], oldHandle, before } = await openDirectOwners(options)
  const replacement = path.join(root, 'closing-owner-replacement.tmp')
  await writeFile(replacement, 'a replacement inode shared before one owner closes')
  const replacementChanges = [closing.event('change', file, timeoutMs), survivor.event('change', file, timeoutMs)]
  await rename(replacement, file)
  await Promise.all(replacementChanges)
  const after = await stat(file)
  assert.notEqual(after.ino, before.ino)
  const rebound = await assertRebound({ ...options, oldHandle })
  await bounded(closing.watcher.close(), 'one public owner closes after shared inode replacement', timeoutMs)
  await bounded(closing.watcher.close(), 'the closed post-rebind owner repeats close', timeoutMs)
  assert.equal(rebound.closed, false)
  assert.equal(rebound.closeCalls, 0, 'closing one owner cannot close the shared replacement handle')
  await waitForObservedEventPhase(survivor, file, evidence, timeoutMs)
  const boundary = closing.events.length
  const nextChange = survivor.event('change', file, timeoutMs)
  await writeFile(file, 'the surviving owner observes the next real write on the rebound inode')
  await nextChange
  await turn()
  assert.equal(closing.events.length, boundary)
  assert.equal(await readFile(file, 'utf8'), 'the surviving owner observes the next real write on the rebound inode')
  assert.deepEqual(survivor.errors, [])
  assert.deepEqual(closing.errors, [])
  await bounded(survivor.watcher.close(), 'the last post-rebind public owner closes', timeoutMs)
  await bounded(survivor.watcher.close(), 'the last post-rebind owner repeats close', timeoutMs)
  await instrumentation.assertAllClosed(timeoutMs, true)
  evidence.push({ checkpoint: 'post-rebind-owner-close-preserves-survivor-and-exact-final-close', oldInode: String(before.ino), newInode: String(after.ino), native: instrumentation.snapshot() })
}
