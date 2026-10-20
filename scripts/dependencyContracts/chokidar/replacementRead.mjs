import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { bounded, turn } from './support.mjs'

export async function verifyReplacementRead({
  chokidar,
  root,
  watched,
  target,
  image,
  timeoutMs,
  open,
  ready,
  instrumentation,
  heldRead,
  arm,
  evidence,
}) {
  const owner = open(chokidar)
  await ready(owner)
  arm()
  const trigger = path.join(target, 'trigger.txt')
  await writeFile(trigger, 'arm the next exact target directory read')
  await bounded(heldRead.entered.promise, 'armed second target readdir captured its real result', timeoutMs)
  const removed = owner.event('unlinkDir', target, timeoutMs)
  await rm(target, { recursive: true })
  await removed
  const recreateBoundary = owner.events.length
  const recreated = owner.event('add', image, timeoutMs)
  await mkdir(target, { recursive: true })
  await writeFile(image, 'new generation image absent from the held old listing')
  await recreated
  assert.equal(!!heldRead.resultReturned, false, 'new generation discovers image while the old exact target readdir result remains held')
  assert.equal(await readFile(image, 'utf8'), 'new generation image absent from the held old listing')
  evidence.push({ checkpoint: 'new-image-add-before-old-read-release', passed: true })

  const releaseBoundary = owner.events.length
  const nativeBoundary = instrumentation.attempts.length
  heldRead.release.resolve()
  await bounded(heldRead.returned.promise, 'old target readdir result released', timeoutMs)
  await turn()
  const barrier = path.join(watched, 'replacement-event-barrier.txt')
  const barrierAdded = owner.event('add', barrier, timeoutMs)
  await writeFile(barrier, 'public event barrier after the old result returned')
  await barrierAdded
  await turn()
  assert.ok(owner.watcher._streams instanceof Set, 'diagnostic stream ownership registry is available')
  const registeredStreams = owner.watcher._streams.size
  const destroyedRegisteredStreams = [...owner.watcher._streams].filter(stream => stream.destroyed).length
  evidence.push({ checkpoint: 'live-owner-read-resource-release', registeredStreams, destroyedRegisteredStreams })
  assert.equal(destroyedRegisteredStreams, 0, 'a live FSWatcher must not retain destroyed directory streams after the old read is canceled and released')
  const relative = file => path.relative(root, file).replaceAll('\\', '/')
  const oldLabels = [relative(path.join(target, 'old-only.txt')), relative(trigger)]
  const afterRelease = owner.events.slice(releaseBoundary)
  assert.equal(afterRelease.some(event => event.event === 'add' && oldLabels.includes(event.path)), false, 'released old listing cannot publish stale child adds')
  assert.equal(instrumentation.attempts.slice(nativeBoundary).some(attempt => oldLabels.includes(attempt.path)), false, 'released old listing cannot attempt stale child native registration')
  const currentImageEvents = owner.events.slice(recreateBoundary).filter(event => event.path === relative(image))
  assert.equal(currentImageEvents.filter(event => event.event === 'add').length, 1, 'replacement image has one public add')
  assert.equal(currentImageEvents.some(event => event.event === 'unlink'), false, 'old listing cannot remove a live new-generation image')
  evidence.push({ checkpoint: 'old-result-cannot-mutate-replacement-owner', passed: true })

  const change = owner.event('change', image, timeoutMs)
  await writeFile(image, 'changed new generation image with another size')
  await change
  assert.equal(await readFile(image, 'utf8'), 'changed new generation image with another size')
  const unlink = owner.event('unlink', image, timeoutMs)
  await rm(image)
  await unlink
  assert.deepEqual(owner.errors, [])
  evidence.push({ checkpoint: 'replacement-image-change-unlink', passed: true })
}
