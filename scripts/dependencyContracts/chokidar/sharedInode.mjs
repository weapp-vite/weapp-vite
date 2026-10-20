import assert from 'node:assert/strict'
import { readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { turn, waitForObservedEventPhase } from './support.mjs'

/** 两个 owner 直接 watch 同一个真实文件，避免父目录广播掩盖失效句柄。 */
export async function verifySharedInode({ chokidar, root, timeoutMs, open, ready, instrumentation, evidence }) {
  assert.ok(['darwin', 'linux', 'freebsd'].includes(instrumentation.actualPlatform), 'native inode contract requires POSIX inode-watch semantics')
  const file = path.join(root, 'shared-inode.txt')
  const replacement = path.join(root, 'replacement.tmp')
  await writeFile(file, 'first inode')
  const first = open(chokidar, file)
  await ready(first)
  const second = open(chokidar, file)
  await ready(second)
  const fileLabel = path.relative(root, file).replaceAll('\\', '/')
  const original = instrumentation.handles.filter(handle => handle.path === fileLabel)
  assert.equal(original.length, 1, 'two direct-file owners initially share exactly one native handle')
  assert.equal(instrumentation.handles.length, 1, 'no parent-directory watcher can mask native file rebinding')
  const oldHandle = original[0]
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
  const nativeRebound = oldHandle.closeCalls === 1 && oldHandle.closeEvents === 1
    && instrumentation.handles.filter(handle => handle.path === fileLabel && !handle.closed).length === 1
    && instrumentation.handles.some(handle => handle.path === fileLabel && handle !== oldHandle && !handle.closed)
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
  assert.ok(nativeRebound, 'both owners must move from the old inode to one shared replacement native handle')
  assert.ok(outcomes.every(outcome => outcome.status === 'fulfilled'), 'both owners must receive the next real change after inode replacement')
  assert.equal(await readFile(file, 'utf8'), 'the new inode must report a subsequent real change to both direct owners')
  assert.equal(instrumentation.handles.some(handle => handle.path !== fileLabel), false, 'no parent-directory watcher may mask a failed rebind at any phase')
  for (const owner of [first, second]) {
    assert.deepEqual(owner.errors, [])
  }
}
