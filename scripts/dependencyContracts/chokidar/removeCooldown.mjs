import assert from 'node:assert/strict'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createAtomicDeliveryObserver } from './atomicDelivery.mjs'
import { bounded, deferred, turn } from './support.mjs'

export function holdRemoveEntries(owner, root, expected) {
  const captured = new Map()
  const failures = []
  const initialFacts = owner.watcher.tree
    ? new Map([...expected.keys()].map(file => [file, {
        fact: owner.watcher.tree.observed.get(file),
        tracked: owner.watcher.tree.peekDirectory(path.dirname(file))?.has(path.basename(file)),
      }]))
    : undefined
  const capture = (file) => {
    if (captured.has(file)) {
      return
    }
    if (initialFacts) {
      // v6 删除由 tree membership 幂等提交，不再持有 remove 冷却计时器。
      const initial = initialFacts.get(file)
      if (!initial?.tracked || owner.watcher.tree.peekDirectory(path.dirname(file))?.has(path.basename(file))) {
        failures.push(`The removed tree fact is still current for ${path.relative(root, file)}`)
      }
      captured.set(file, initial)
      return
    }
    const entry = owner.watcher._throttled?.get('remove')?.get(file)
    if (!entry || typeof entry.clear !== 'function' || !entry.timeoutObject) {
      failures.push(`No live exact remove throttle for ${path.relative(root, file)}`)
      return
    }
    clearTimeout(entry.timeoutObject)
    captured.set(file, entry)
  }
  const listener = (event, file) => {
    const absolute = path.resolve(String(file))
    if (expected.get(absolute) === event) {
      capture(absolute)
    }
  }
  owner.watcher.on('all', listener)
  return {
    capture,
    assertCaptured() {
      assert.deepEqual(failures, [])
      assert.equal(captured.size, expected.size, 'each first real unlink captures its still-active exact remove cooldown')
    },
    snapshot(stage) {
      return {
        stage,
        failures: failures.slice(),
        mechanism: initialFacts ? 'tree-membership' : 'remove-cooldown',
        entries: [...captured].map(([file, entry], index) => ({
          identity: `old-remove-${index + 1}`,
          path: path.relative(root, file).replaceAll('\\', '/'),
          oldTimerExplicitlyReleased: false,
          oldEntryStillCurrent: initialFacts ? Boolean(entry.fact && owner.watcher.tree.observed.get(file) === entry.fact) : owner.watcher._throttled?.get('remove')?.get(file) === entry,
          duplicateCount: entry?.count,
        })),
      }
    },
    close() {
      owner.watcher.off('all', listener)
      if (initialFacts) {
        return
      }
      for (const [file, entry] of captured) {
        if (owner.watcher._throttled?.get('remove')?.get(file) === entry) {
          entry.clear()
        }
        else { clearTimeout(entry.timeoutObject) }
      }
    },
  }
}

async function verifyFile({ chokidar, root, watched, timeoutMs, open, ready, evidence }) {
  const file = path.join(watched, 'cooldown-file.txt')
  await writeFile(file, 'first generation')
  const owner = open(chokidar, watched, { atomic: false })
  await ready(owner)
  const boundary = owner.events.length
  const gate = holdRemoveEntries(owner, root, new Map([[file, 'unlink']]))
  let afterAdd
  let eventChainPassed = false
  try {
    const firstUnlink = owner.event('unlink', file, timeoutMs)
    await rm(file)
    await firstUnlink
    gate.assertCaptured()
    const add = owner.event('add', file, timeoutMs)
    await writeFile(file, 'second generation at the exact same path')
    await add
    assert.equal(await readFile(file, 'utf8'), 'second generation at the exact same path')
    afterAdd = gate.snapshot('after-new-file-add-before-second-remove')
    const secondUnlink = owner.event('unlink', file, timeoutMs)
    await rm(file)
    await secondUnlink
    const relative = path.relative(root, file).replaceAll('\\', '/')
    assert.deepEqual(owner.events.slice(boundary).filter(event => event.path === relative && ['add', 'unlink'].includes(event.event)).map(event => event.event), ['unlink', 'add', 'unlink'])
    assert.deepEqual(owner.errors, [])
    eventChainPassed = true
  }
  finally {
    evidence.push({ checkpoint: 'file-unlink-add-unlink-with-old-cooldown-held', eventChainPassed, afterAdd, beforeGateCleanup: gate.snapshot('before-gate-cleanup') })
    gate.close()
  }
}

async function verifyDirectory({ chokidar, root, watched, timeoutMs, open, ready, evidence }) {
  const directory = path.join(watched, 'cooldown-directory')
  const leaf = path.join(directory, 'leaf.txt')
  await mkdir(directory)
  await writeFile(leaf, 'first nested generation')
  const owner = open(chokidar, watched, { atomic: false })
  await ready(owner)
  const boundary = owner.events.length
  const gate = holdRemoveEntries(owner, root, new Map([[directory, 'unlinkDir'], [leaf, 'unlink']]))
  let afterAdd
  let eventChainPassed = false
  try {
    const firstUnlinks = Promise.all([owner.event('unlinkDir', directory, timeoutMs), owner.event('unlink', leaf, timeoutMs)])
    await rm(directory, { recursive: true })
    await firstUnlinks
    gate.assertCaptured()
    const adds = Promise.all([owner.event('addDir', directory, timeoutMs), owner.event('add', leaf, timeoutMs)])
    await mkdir(directory)
    await writeFile(leaf, 'second nested generation at the same paths')
    await adds
    afterAdd = gate.snapshot('after-new-directory-and-leaf-add-before-second-remove')
    const secondUnlinks = Promise.all([owner.event('unlinkDir', directory, timeoutMs), owner.event('unlink', leaf, timeoutMs)])
    await rm(directory, { recursive: true })
    await secondUnlinks
    const relative = file => path.relative(root, file).replaceAll('\\', '/')
    const events = owner.events.slice(boundary)
    assert.deepEqual(events.filter(event => event.path === relative(directory) && ['addDir', 'unlinkDir'].includes(event.event)).map(event => event.event), ['unlinkDir', 'addDir', 'unlinkDir'])
    assert.deepEqual(events.filter(event => event.path === relative(leaf) && ['add', 'unlink'].includes(event.event)).map(event => event.event), ['unlink', 'add', 'unlink'])
    assert.deepEqual(owner.errors, [])
    eventChainPassed = true
  }
  finally {
    evidence.push({ checkpoint: 'directory-and-child-generation-removal-with-old-cooldowns-held', eventChainPassed, afterAdd, beforeGateCleanup: gate.snapshot('before-gate-cleanup') })
    gate.close()
  }
}

function holdAtomicFlush(owner, file, removeGate) {
  const pending = owner.watcher.events?.pendingUnlinks ?? owner.watcher._pendingUnlinks
  assert.ok(pending instanceof Map, 'diagnostic atomic pending buffer is available')
  const setDescriptor = Object.getOwnPropertyDescriptor(pending, 'set')
  const originalSet = pending.set
  const scheduler = owner.watcher.scheduler ?? globalThis
  const originalSetTimeout = scheduler.setTimeout
  const created = new Map()
  const buffered = deferred()
  let armed = false
  let captured
  let released = false
  scheduler.setTimeout = function (callback, delay, ...args) {
    const timer = originalSetTimeout.call(this, callback, delay, ...args)
    created.set(timer, { timer, callback, args })
    if (armed && delay === 100) {
      armed = false
      clearTimeout(timer)
      captured = { timer, callback, args }
    }
    return timer
  }
  Object.defineProperty(pending, 'set', {
    configurable: true,
    writable: true,
    value(key, value) {
      const result = originalSet.call(this, key, value)
      if (key === file && !captured && !armed) {
        removeGate.capture(file)
        if (value.timer) {
          captured = created.get(value.timer)
          assert.ok(captured, 'the exact v6 unlink timer was created by its original scheduler')
          scheduler.clearTimeout(value.timer)
        }
        else { armed = true }
        buffered.resolve()
      }
      return result
    },
  })
  const release = () => {
    if (captured && !released) {
      released = true
      return captured.callback.apply(captured.timer, captured.args)
    }
  }
  return {
    buffered: buffered.promise,
    assertCaptured() { assert.ok(captured, 'the exact buffered unlink owns a held original atomic timeout callback') },
    release,
    close() {
      scheduler.setTimeout = originalSetTimeout
      if (setDescriptor) {
        Object.defineProperty(pending, 'set', setDescriptor)
      }
      else { delete pending.set }
      release()
      if (captured) {
        clearTimeout(captured.timer)
      }
    },
  }
}

function closeAtomicObservation(cleanups, operationFailures) {
  const cleanupFailures = []
  for (const cleanup of cleanups) {
    try {
      cleanup()
    }
    catch (error) { cleanupFailures.push(error) }
  }
  if (cleanupFailures.length) {
    throw new AggregateError([...operationFailures, ...cleanupFailures], 'atomic verification cleanup failed')
  }
}

async function verifyAtomic({ chokidar, root, watched, timeoutMs, open, ready, instrumentation, evidence }) {
  const file = path.join(watched, 'cooldown-atomic.txt')
  const replacement = path.join(root, 'cooldown-atomic-replacement.txt')
  const contents = 'replacement atomic generation remains a single public change'
  await writeFile(file, 'first atomic generation')
  await writeFile(replacement, contents)
  const replacementStats = await stat(replacement)
  const observer = createAtomicDeliveryObserver({ root, file })
  let removeGate
  let atomicGate
  let afterChange
  let coalescingPassed = false
  const operationFailures = []
  try {
    const owner = open(chokidar, watched, { atomic: 100 })
    observer.attach(owner)
    await ready(owner)
    await instrumentation.settleDirectoryRegistration(timeoutMs)
    assert.deepEqual(owner.errors, [], 'native registration errors cannot count as a completed atomic preparation barrier')
    const boundary = owner.events.length
    observer.start()
    removeGate = holdRemoveEntries(owner, root, new Map([[file, 'unlink']]))
    atomicGate = holdAtomicFlush(owner, file, removeGate)
    await rm(file)
    await bounded(atomicGate.buffered, 'the real file removal enters its atomic unlink buffer', timeoutMs)
    atomicGate.assertCaptured()
    removeGate.assertCaptured()
    const change = owner.event('change', file, timeoutMs)
    await rename(replacement, file)
    await change
    assert.equal(await readFile(file, 'utf8'), contents)
    assert.equal((owner.watcher.events?.pendingUnlinks ?? owner.watcher._pendingUnlinks).has(file), false, 'native re-add consumes the original atomic unlink buffer')
    afterChange = removeGate.snapshot('after-atomic-change-before-original-flush-release')
    await observer.flush(() => atomicGate.release())
    await turn()
    await bounded(owner.watcher.close(), 'atomic owner close before final causal verification', timeoutMs)
    await owner.eventPhases.settle(timeoutMs)
    const relative = path.relative(root, file).replaceAll('\\', '/')
    const events = owner.events.slice(boundary).filter(event => event.path === relative)
    observer.assert(replacementStats, await stat(file), events.map(event => event.event))
    assert.deepEqual(owner.errors, [])
    coalescingPassed = true
  }
  catch (error) {
    operationFailures.push(error)
    throw error
  }
  finally {
    closeAtomicObservation([() => atomicGate?.close(), () => removeGate?.close(), () => {
      evidence.push({ checkpoint: 'atomic-buffer-survives-remove-generation-reset', coalescingPassed, afterChange, delivery: observer.snapshot() })
    }, () => observer.close()], operationFailures)
  }
}

export async function verifyRemoveCooldown(options) {
  if (options.entryType === 'directory') {
    return verifyDirectory(options)
  }
  if (options.entryType === 'atomic') {
    return verifyAtomic(options)
  }
  return verifyFile(options)
}
