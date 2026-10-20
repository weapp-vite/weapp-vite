import assert from 'node:assert/strict'
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { bounded, deferred, releaseCompletedEventPhase, turn } from './support.mjs'

async function verifyInode({ chokidar, root, watched, timeoutMs, open, ready, instrumentation, evidence }) {
  assert.ok(['darwin', 'linux', 'freebsd'].includes(instrumentation.actualPlatform), 'native inode branch requires darwin/linux/freebsd; another native host is a diagnostic limitation')
  const file = path.join(watched, 'inode-file.txt')
  const replacement = path.join(watched, 'inode-replacement.tmp')
  await writeFile(file, 'original inode')
  const owner = open(chokidar, watched, { atomic: false })
  await ready(owner)
  const relative = path.relative(root, file).replaceAll('\\', '/')
  const originalHandle = instrumentation.handles.find(record => record.path === relative)
  assert.ok(originalHandle, 'original file has a real native handle')
  const originalStats = await stat(file)
  await writeFile(replacement, 'replacement inode with a distinct size')
  const firstChange = owner.event('change', file, timeoutMs)
  await rename(replacement, file)
  await firstChange
  const replacementStats = await stat(file)
  assert.notEqual(replacementStats.ino, originalStats.ino, 'real rename replaced the actual inode')
  await bounded(originalHandle.closePromise, 'inode replacement closes the old native file handle', timeoutMs)
  const live = instrumentation.handles.filter(record => record.path === relative && !record.closed)
  assert.equal(live.length, 1, 'inode replacement acquired exactly one live native file handle')
  assert.notEqual(live[0], originalHandle)
  evidence.push({ checkpoint: 'real-inode-rebind', passed: true, actualPlatform: instrumentation.actualPlatform })
  releaseCompletedEventPhase(owner, file, evidence)
  const secondChange = owner.event('change', file, timeoutMs)
  await writeFile(file, 'the rebound native file watcher observes this second change')
  await secondChange
  assert.equal(await readFile(file, 'utf8'), 'the rebound native file watcher observes this second change')
  assert.deepEqual(owner.errors, [])
  evidence.push({ checkpoint: 'second-change-after-real-inode-rebind', passed: true })
}

async function verifyPolling({ chokidar, watched, timeoutMs, open, ready, instrumentation, evidence }) {
  const file = path.join(watched, 'polling-file.txt')
  await writeFile(file, 'initial polling generation')
  const owner = open(chokidar, watched, { usePolling: true, interval: 10, binaryInterval: 10, atomic: false })
  await ready(owner)
  assert.ok(instrumentation.pollingHandles.length > 0, 'polling uses real native StatWatcher subscriptions')
  assert.equal(instrumentation.handles.length, 0, 'the polling case did not fall back to fs.watch')
  const firstChange = owner.event('change', file, timeoutMs)
  await writeFile(file, 'first observed polling file update with a different size')
  await firstChange
  const unlink = owner.event('unlink', file, timeoutMs)
  await rm(file)
  await unlink
  const add = owner.event('add', file, timeoutMs)
  await writeFile(file, 'recreated polling file')
  await add
  releaseCompletedEventPhase(owner, file, evidence)
  const nextChange = owner.event('change', file, timeoutMs)
  await writeFile(file, 'the recreated polling file reports its next real update')
  await nextChange
  assert.equal(await readFile(file, 'utf8'), 'the recreated polling file reports its next real update')
  assert.deepEqual(owner.errors, [])
  instrumentation.markPublicClose()
  await bounded(owner.watcher.close(), 'public polling close', timeoutMs)
  await bounded(owner.watcher.close(), 'repeated public polling close', timeoutMs)
  await instrumentation.assertAllClosed(timeoutMs)
  assert.equal(instrumentation.pollingHandles.some(record => !record.stopped), false)
  evidence.push({ checkpoint: 'polling-events-and-real-statwatcher-stop', passed: true, stoppedSubscriptions: instrumentation.pollingHandles.length })
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
    const nativeHandle = instrumentation.handles.find(record => record.path === relative)
    assert.ok(nativeHandle, 'shared owner already holds the real file native handle')
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
    releaseCompletedEventPhase(shared, file, evidence)
    const sharedChange = shared.event('change', file, timeoutMs)
    await writeFile(file, `shared owner still observes update after synchronous ${phase} ${mode}`)
    await sharedChange
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
