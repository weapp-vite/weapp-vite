import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { bounded, deferred, turn, waitForObservedEventPhase } from './support.mjs'

export async function verifyPollingOwners({ chokidar, root, watched, timeoutMs, open, ready, instrumentation, evidence, closeUpgrader }) {
  const file = path.join(watched, 'shared-polling.json')
  const otherFile = path.join(root, 'other-project.json')
  await writeFile(file, '{}')
  await writeFile(otherFile, '{}')
  const options = { backend: 'polling', atomic: false }
  const slow = open(chokidar, file, { ...options, pollingInterval: 120, pollingBinaryInterval: 120, persistent: false })
  const other = open(chokidar, otherFile, { ...options, pollingInterval: 80, pollingBinaryInterval: 80 })
  await Promise.all([ready(slow), ready(other)])
  const previous = await instrumentation.polling.pendingPoll(file, 120, timeoutMs)
  assert.equal(previous.persistent, false, 'the initial non-persistent owner does not retain the event loop')
  const fast = open(chokidar, file, { ...options, pollingInterval: 100, pollingBinaryInterval: 100 })
  await ready(fast)
  const upgraded = await instrumentation.polling.pendingPoll(file, 100, timeoutMs)
  assert.equal(upgraded.persistent, true, 'a persistent owner upgrades the shared timer')
  assert.notEqual(upgraded.id, previous.id, 'the faster interval replaces the pending timer')
  const previousTimer = instrumentation.polling.timers.find(record => record.id === previous.id)
  assert.ok(previousTimer.cleared || previousTimer.fired, 'the old schedule is terminal before replacement')
  const sibling = open(chokidar, file, { ...options, pollingInterval: 160, pollingBinaryInterval: 160 })
  await ready(sibling)
  assert.equal(instrumentation.handles.length, 0, 'all owners retain polling instead of acquiring fs.watch')
  await instrumentation.polling.pendingPoll(file, 100, timeoutMs)
  assert.equal(instrumentation.pollingHandles.length, 0, 'Chokidar polling owns timers without acquiring a native StatWatcher')
  const raw = new Map([slow, fast, sibling].map(owner => [owner, []]))
  for (const [owner, events] of raw) {
    owner.watcher.on('raw', (_event, _path, data) => events.push(data.current?.size))
  }
  let externalWaiter
  const externalListener = curr => externalWaiter?.(curr)
  const external = fs.watchFile(file, { interval: 100 }, externalListener)
  const externalStopped = deferred()
  external.once('stop', () => externalStopped.resolve())
  let length = 2
  const closed = []

  async function publish(checkpoint, active) {
    for (const owner of active) {
      await waitForObservedEventPhase(owner, file, evidence, timeoutMs)
    }
    await waitForObservedEventPhase(other, otherFile, evidence, timeoutMs)
    length += 30
    const content = '{}'.padEnd(length, ' ')
    assert.equal(Buffer.byteLength(content), length)
    const changed = active.map(owner => owner.event('change', file, timeoutMs, stats => stats?.size === length))
    changed.push(other.event('change', otherFile, timeoutMs, stats => stats?.size === length))
    const externalChange = deferred()
    externalWaiter = curr => curr.size === length && externalChange.resolve()
    const boundary = closed.map(owner => ({ owner, events: owner.events.length, raw: raw.get(owner).length }))
    await writeFile(file, content, { flag: 'r+' })
    await writeFile(otherFile, content, { flag: 'r+' })
    await Promise.all([...changed, bounded(externalChange.promise, 'independent native listener observes the current polling value', timeoutMs)])
    await turn()
    for (const owner of active) {
      assert.ok(raw.get(owner).includes(length), 'every active owner retains raw delivery across interval upgrades')
    }
    for (const item of boundary) {
      assert.equal(item.owner.events.length, item.events, 'closed owner receives no further public events')
      assert.equal(raw.get(item.owner).length, item.raw, 'closed owner receives no further raw events')
    }
    assert.equal(await readFile(file, 'utf8'), content)
    assert.equal(await readFile(otherFile, 'utf8'), content)
    evidence.push({ checkpoint, passed: true, activeOwners: active.length, closedOwners: closed.length, size: length })
  }

  async function close(owner) {
    await bounded(owner.watcher.close(), 'close the selected polling owner', timeoutMs)
    await bounded(owner.watcher.close(), 'repeat the selected polling owner close', timeoutMs)
    closed.push(owner)
  }

  try {
    await publish('polling-upgrade-retains-all-public-and-native-owners', [slow, fast, sibling])
    const first = closeUpgrader ? fast : slow
    const survivor = closeUpgrader ? slow : fast
    await close(first)
    await publish('polling-first-close-preserves-survivors', [survivor, sibling])
    await close(survivor)
    await publish('polling-second-close-preserves-late-sibling', [sibling])
    await close(sibling)
    await instrumentation.polling.assertPathClosed(file, timeoutMs)
    const readsAfterLastClose = instrumentation.polling.reads.filter(record => record.path === file).length
    assert.ok(instrumentation.pollingHandles.every(record => !record.stopped), 'public owner close preserves the independent native StatWatcher')
    await publish('polling-last-public-close-preserves-native-and-other-project', [])
    assert.equal(instrumentation.polling.reads.filter(record => record.path === file).length, readsAfterLastClose, 'the closed polling resource performs no later stat')
    for (const owner of [slow, fast, sibling, other]) {
      assert.deepEqual(owner.errors, [])
      await bounded(owner.watcher.close(), 'final public polling owner close', timeoutMs)
    }
  }
  finally {
    fs.unwatchFile(file, externalListener)
  }
  await bounded(externalStopped.promise, 'the final exact external release stops the native StatWatcher', timeoutMs)
  assert.ok(instrumentation.snapshot().pollingReleases.every(release => release.exactListener), 'polling release never removes unrelated native listeners')
  await instrumentation.assertAllClosed(timeoutMs)
  evidence.push({ checkpoint: 'polling-all-owned-timers-reads-and-native-handles-stopped', passed: true })
}
