import assert from 'node:assert/strict'
import { access, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { bounded, deferred, turn, waitForObservedEventPhase } from './support.mjs'

async function openDirectOwners({ chokidar, root, file, open, ready, instrumentation }) {
  assert.ok(['darwin', 'linux', 'freebsd'].includes(instrumentation.actualPlatform))
  await writeFile(file, 'first shared boundary inode')
  const owners = [open(chokidar, file)]
  await ready(owners[0])
  owners.push(open(chokidar, file))
  await ready(owners[1])
  assert.equal(instrumentation.handles.length, 1, 'two direct-file owners share one native handle without parent-directory coverage')
  const oldHandle = instrumentation.handles[0]
  assert.equal(oldHandle.path, path.relative(root, file).replaceAll('\\', '/'))
  return { owners, oldHandle, before: await stat(file) }
}

async function assertRebound({ instrumentation, oldHandle, timeoutMs }) {
  await bounded(oldHandle.closePromise, 'shared inode replacement closes the original native handle', timeoutMs)
  assert.equal(oldHandle.closeCalls, 1)
  assert.equal(oldHandle.closeEvents, 1)
  assert.equal(instrumentation.handles.length, 2, 'shared owners acquire one replacement and no parent-directory handle')
  const live = instrumentation.handles.filter(handle => !handle.closed)
  assert.equal(live.length, 1)
  assert.notEqual(live[0], oldHandle)
  assert.equal(live[0].path, oldHandle.path)
  return live[0]
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
    assert.equal(gate.requests.filter(request => request.firstWave).length, 2, 'the single direct native handle synchronously dispatches one stat to each sibling')
    assert.equal(instrumentation.handles.length, 1)
    assert.equal(oldHandle.closed, false)
    await writeFile(replacement, 'a distinct replacement inode exists while the old file is still present')
    assert.notEqual((await stat(replacement)).ino, before.ino)
    await rm(file)
    await assert.rejects(access(file), { code: 'ENOENT' })
    gate.run(0)
    await bounded(gate.requests[0].observed.promise, 'the old sibling obtains a real native ENOENT', timeoutMs)
    const heldError = gate.requests[0].nativeError
    assert.equal(heldError?.code, 'ENOENT')
    assert.equal(heldError?.syscall, 'stat')
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
      const ownEvents = owner.events.slice(lateBoundary[index]).filter(event => event.path === oldHandle.path)
      assert.equal(ownEvents.some(event => ['unlink', 'add'].includes(event.event)), false, 'a late sibling error cannot remove or rediscover the replacement file')
      assert.equal(owner.events.slice(boundaries[index]).some(event => ['unlink', 'add'].includes(event.event)), false)
      assert.deepEqual(owner.errors, [])
      await waitForObservedEventPhase(owner, file, evidence, timeoutMs)
    }
    const nextChanges = owners.map(owner => owner.event('change', file, timeoutMs))
    await writeFile(file, 'both direct owners still observe a real change after the old sibling ENOENT')
    await Promise.all(nextChanges)
    assert.equal(await readFile(file, 'utf8'), 'both direct owners still observe a real change after the old sibling ENOENT')
    assert.equal(instrumentation.handles.length, 2)
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
