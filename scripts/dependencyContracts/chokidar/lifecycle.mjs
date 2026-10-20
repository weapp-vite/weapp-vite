import assert from 'node:assert/strict'
import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { recreateAndExercise } from './registration.mjs'
import { bounded, turn } from './support.mjs'

export async function closeDuringScan(chokidar, ctx) {
  const { scenario, heldRead, heldStat, instrumentation, open, timeoutMs } = ctx
  const owner = open(chokidar)
  const block = scenario.block === 'readdir' ? heldRead : heldStat
  await bounded(block.entered.promise, `${scenario.block} operation reached explicit gate`, timeoutMs)
  const attemptsAtClose = instrumentation.attempts.length
  instrumentation.markPublicClose()
  await bounded(owner.watcher.close(), 'public close while scan is gated', timeoutMs)
  await instrumentation.assertAllClosed(timeoutMs)
  block.release.resolve()
  await bounded(block.returned.promise, 'gated filesystem result returned', timeoutMs)
  await turn()
  await turn()
  assert.equal(instrumentation.attempts.length, attemptsAtClose, 'a pre-close async scan cannot acquire native handles after close')
  assert.equal(instrumentation.handles.some(record => record.afterPublicClose), false)
  await bounded(owner.watcher.close(), 'repeated public close', timeoutMs)
}

export async function removeDuringStat(chokidar, ctx) {
  const { root, watched, target, statChild, heldStat, instrumentation, open, ready, timeoutMs } = ctx
  const owner = open(chokidar)
  await bounded(heldStat.entered.promise, 'child stat captures pre-deletion result', timeoutMs)
  const removed = owner.event('unlinkDir', target, timeoutMs)
  await rm(target, { recursive: true })
  await removed
  const eventBoundary = owner.events.length
  heldStat.release.resolve()
  await bounded(heldStat.returned.promise, 'old child stat result returns', timeoutMs)
  const sentinel = path.join(watched, 'sentinel.txt')
  const sentinelAdded = owner.event('add', sentinel, timeoutMs)
  await writeFile(sentinel, 'public event barrier after old stat returns')
  await sentinelAdded
  await ready(owner)
  const childLabel = path.relative(root, statChild).replaceAll('\\', '/')
  assert.equal(owner.events.slice(eventBoundary).some(event => event.event === 'add' && event.path === childLabel), false, 'a removed parent must invalidate its in-flight child discovery')
  assert.equal(instrumentation.handles.some(record => !record.closed && record.path.startsWith('src/extra/')), false, 'removed subtree cannot retain a late child native handle')
  await recreateAndExercise(owner, ctx)
  assert.deepEqual(owner.errors, [])
}

export async function shared(chokidar, ctx, failSibling) {
  const { stable, watched, stableFile, instrumentation, open, ready, timeoutMs } = ctx
  const first = open(chokidar, stable)
  await ready(first)
  const stableHandle = instrumentation.handles.find(record => record.path === 'src/stable')
  assert.ok(stableHandle, 'first owner acquired the real stable-directory watcher')
  const second = open(chokidar, failSibling ? watched : stable)
  await ready(second)
  assert.equal(instrumentation.handles.filter(record => record.path === 'src/stable').length, 1, 'persistent public owners share one exact native handle')
  if (failSibling) {
    assert.equal(ctx.injected, 1)
  }
  await bounded(second.watcher.close(), 'second owner closes', timeoutMs)
  assert.equal(stableHandle.closed, false, 'closing one owner preserves another owner of the same native watcher')
  const change = first.event('change', stableFile, timeoutMs)
  await writeFile(stableFile, 'another owner still receives this shared watcher update')
  await change
  assert.deepEqual(first.errors, [])
  assert.deepEqual(second.errors, [])
  await bounded(second.watcher.close(), 'second owner repeats close', timeoutMs)
  await bounded(first.watcher.close(), 'last shared owner closes', timeoutMs)
  await instrumentation.assertAllClosed(timeoutMs)
}
