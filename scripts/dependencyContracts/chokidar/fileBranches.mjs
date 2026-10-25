import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { bounded, deferred, turn, waitForObservedEventPhase } from './support.mjs'

async function verifyInode({ chokidar, root, watched, timeoutMs, open, ready, instrumentation, evidence, backend }) {
  assert.ok(['darwin', 'linux', 'freebsd'].includes(instrumentation.actualPlatform), 'native inode branch requires darwin/linux/freebsd; another native host is a diagnostic limitation')
  const file = path.join(watched, 'inode-file.txt')
  const replacement = path.join(root, 'inode-replacement.tmp')
  await writeFile(file, 'original inode')
  // 在订阅前准备同一文件系统的替换文件，避免准备写入与待验证的 rename 竞争。
  await writeFile(replacement, 'replacement inode with a distinct size')
  const originalStats = await stat(file)
  const replacementStats = await stat(replacement)
  const owner = open(chokidar, watched, { atomic: false, ...(backend ? { backend } : {}) })
  await ready(owner)
  const relative = path.relative(root, watched).replaceAll('\\', '/')
  const originalHandle = instrumentation.handles.find(record => record.path === relative)
  assert.ok(originalHandle, 'the file is covered by its real native directory handle')
  await waitForObservedEventPhase(owner, file, evidence, timeoutMs)
  const firstChange = owner.event('change', file, timeoutMs, stats => stats?.dev === replacementStats.dev && stats?.ino === replacementStats.ino && stats?.size === replacementStats.size)
  await rename(replacement, file)
  await firstChange
  const renamedStats = await stat(file)
  assert.equal(renamedStats.dev, replacementStats.dev, 'real rename preserves the prepared replacement device')
  assert.equal(renamedStats.ino, replacementStats.ino, 'real rename installs the prepared replacement inode')
  assert.notEqual(renamedStats.ino, originalStats.ino, 'real rename replaced the actual inode')
  const live = instrumentation.handles.filter(record => record.path === relative && !record.closed)
  assert.equal(live.length, 1, 'inode replacement preserves one live native directory handle')
  assert.equal(live[0], originalHandle, 'v6 directory coverage survives a file inode replacement')
  evidence.push({ checkpoint: 'real-inode-replacement-with-directory-coverage', passed: true, actualPlatform: instrumentation.actualPlatform })
  await waitForObservedEventPhase(owner, file, evidence, timeoutMs)
  const changed = 'the rebound native file watcher observes this second change'
  assert.ok(Buffer.byteLength(changed) > replacementStats.size, 'the rebound file receives a longer in-place value without a truncate phase')
  const secondChange = owner.event('change', file, timeoutMs, stats => stats?.size === Buffer.byteLength(changed))
  await writeFile(file, changed, { flag: 'r+' })
  await secondChange
  assert.equal(await readFile(file, 'utf8'), changed)
  assert.deepEqual(owner.errors, [])
  evidence.push({ checkpoint: 'second-change-after-real-inode-rebind', passed: true })
}

async function verifyPolling({ chokidar, watched, timeoutMs, open, ready, instrumentation, evidence }) {
  const file = path.join(watched, 'polling-file.txt')
  await writeFile(file, 'initial polling generation')
  const owner = open(chokidar, watched, { backend: 'polling', pollingInterval: 10, pollingBinaryInterval: 10, atomic: false })
  await ready(owner)
  await instrumentation.polling.pendingPoll(file, 10, timeoutMs)
  assert.equal(instrumentation.pollingHandles.length, 0, 'Chokidar polling owns stat timers without borrowing native StatWatchers')
  assert.equal(instrumentation.handles.length, 0, 'the polling case did not fall back to fs.watch')
  await waitForObservedEventPhase(owner, file, evidence, timeoutMs)
  const firstChange = owner.event('change', file, timeoutMs)
  await writeFile(file, 'first observed polling file update with a different size')
  await firstChange
  const unlink = owner.event('unlink', file, timeoutMs)
  await rm(file)
  await unlink
  const add = owner.event('add', file, timeoutMs)
  await writeFile(file, 'recreated polling file')
  await add
  await waitForObservedEventPhase(owner, file, evidence, timeoutMs)
  const nextChange = owner.event('change', file, timeoutMs)
  await writeFile(file, 'the recreated polling file reports its next real update')
  await nextChange
  assert.equal(await readFile(file, 'utf8'), 'the recreated polling file reports its next real update')
  assert.deepEqual(owner.errors, [])
  instrumentation.markPublicClose()
  await bounded(owner.watcher.close(), 'public polling close', timeoutMs)
  await bounded(owner.watcher.close(), 'repeated public polling close', timeoutMs)
  await instrumentation.assertAllClosed(timeoutMs)
  await instrumentation.polling.assertPathClosed(file, timeoutMs)
  evidence.push({ checkpoint: 'polling-events-and-owned-timer-stat-cleanup', passed: true, observedStatReads: instrumentation.polling.reads.length })
}

async function verifySynchronousAddCancel({ chokidar, root, watched, timeoutMs, open, ready, instrumentation, evidence }) {
  const variants = [
    { phase: 'add', mode: 'close' },
    { phase: 'add', mode: 'unwatch' },
    { phase: 'ready', mode: 'close' },
  ].map(variant => ({ ...variant, file: path.join(watched, `sync-${variant.phase}-${variant.mode}.txt`) }))
  for (const {
    file,
  } of variants) {
    await writeFile(file, 'initial shared file')
  }
  const shared = open(chokidar, watched, { atomic: false })
  await ready(shared)
  const transients = []
  for (const { phase, mode, file } of variants) {
    const relative = path.relative(root, file).replaceAll('\\', '/')
    const nativeHandle = instrumentation.handles.find(record => record.path === path.relative(root, watched).replaceAll('\\', '/'))
    assert.ok(nativeHandle, 'shared owner already holds the real native directory handle')
    const transient = open(chokidar, file, { atomic: false })
    transient.readyRequired = phase === 'ready'
    transients.push(transient)
    const canceled = deferred()
    let closePromise
    transient.watcher.once(phase, (added) => {
      try {
        if (phase === 'add') {
          assert.equal(path.resolve(String(added)), file)
        }
        if (mode === 'close') {
          closePromise = transient.watcher.close()
        }
        else { transient.watcher.unwatch(file) }
        canceled.resolve()
      }
      catch (error) { canceled.reject(error) }
    })
    await bounded(canceled.promise, `synchronous ${phase} listener performs ${mode}`, timeoutMs)
    if (closePromise) {
      await bounded(closePromise, `close returned inside ${phase} listener`, timeoutMs)
    }
    assert.equal(nativeHandle.closed, false, 'synchronous cancellation preserves the other native owner')
    const transientBoundary = transient.events.length
    await waitForObservedEventPhase(shared, file, evidence, timeoutMs)
    const changed = `shared owner still observes update after synchronous ${phase} ${mode}`
    assert.ok(Buffer.byteLength(changed) > Buffer.byteLength('initial shared file'), 'the shared owner receives a longer in-place value without a truncate phase')
    const sharedChange = shared.event('change', file, timeoutMs, stats => stats?.size === Buffer.byteLength(changed))
    await writeFile(file, changed, { flag: 'r+' })
    await sharedChange
    assert.equal(await readFile(file, 'utf8'), changed, 'the surviving shared owner observes the final written value')
    const barrier = path.join(watched, `sync-${phase}-${mode}-barrier.txt`)
    const barrierAdded = shared.event('add', barrier, timeoutMs)
    await writeFile(barrier, 'public event barrier after the shared file update')
    await barrierAdded
    await turn()
    assert.equal(transient.events.slice(transientBoundary).some(event => event.path === relative), false, 'canceled owner receives no later file events')
    assert.deepEqual(shared.errors, [])
    assert.deepEqual(transient.errors, [])
    evidence.push({ checkpoint: `synchronous-${phase}-${mode}-preserves-shared-owner`, passed: true, transientReadyCount: transient.readyCount })
  }
  await bounded(shared.watcher.close(), 'last active shared owner closes before unwatch-only owner', timeoutMs)
  await instrumentation.assertAllClosed(timeoutMs)
  for (const transient of transients) {
    await bounded(transient.watcher.close(), 'canceled transient closes after native handles are already terminal', timeoutMs)
    await bounded(transient.watcher.close(), 'canceled transient repeats close', timeoutMs)
  }
  evidence.push({ checkpoint: 'synchronous-add-cancel-leaves-no-native-listener', passed: true })
}

export async function verifyFileBranches(options) {
  if (options.branch === 'inode') {
    return verifyInode(options)
  }
  if (options.branch === 'polling') {
    return verifyPolling(options)
  }
  return verifySynchronousAddCancel(options)
}
