import assert from 'node:assert/strict'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { bounded, deferred, turn } from './support.mjs'

export function holdRemoveEntries(owner, root, expected) {
  const captured = new Map()
  const failures = []
  const capture = (file) => {
    if (captured.has(file)) {
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
        entries: [...captured].map(([file, entry], index) => ({
          identity: `old-remove-${index + 1}`,
          path: path.relative(root, file).replaceAll('\\', '/'),
          oldTimerExplicitlyReleased: false,
          oldEntryStillCurrent: owner.watcher._throttled?.get('remove')?.get(file) === entry,
          duplicateCount: entry.count,
        })),
      }
    },
    close() {
      owner.watcher.off('all', listener)
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
  const pending = owner.watcher._pendingUnlinks
  assert.ok(pending instanceof Map, 'diagnostic atomic pending buffer is available')
  const setDescriptor = Object.getOwnPropertyDescriptor(pending, 'set')
  const originalSet = pending.set
  const originalSetTimeout = globalThis.setTimeout
  const buffered = deferred()
  let armed = false
  let captured
  let released = false
  globalThis.setTimeout = function (callback, delay, ...args) {
    const timer = originalSetTimeout(callback, delay, ...args)
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
        armed = true
        buffered.resolve()
      }
      return result
    },
  })
  const release = () => {
    if (captured && !released) {
      released = true
      captured.callback.apply(captured.timer, captured.args)
    }
  }
  return {
    buffered: buffered.promise,
    assertCaptured() { assert.ok(captured, 'the exact buffered unlink owns a held original atomic timeout callback') },
    release,
    close() {
      globalThis.setTimeout = originalSetTimeout
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

async function verifyAtomic({ chokidar, root, watched, timeoutMs, open, ready, instrumentation, evidence }) {
  const file = path.join(watched, 'cooldown-atomic.txt')
  const replacement = path.join(root, 'cooldown-atomic-replacement.txt')
  const contents = 'replacement atomic generation remains a single public change'
  await writeFile(file, 'first atomic generation')
  await writeFile(replacement, contents)
  const owner = open(chokidar, watched, { atomic: 100 })
  await ready(owner)
  await instrumentation.settleDirectoryRegistration(timeoutMs)
  assert.deepEqual(owner.errors, [], 'native registration errors cannot count as a completed atomic preparation barrier')
  const boundary = owner.events.length
  const removeGate = holdRemoveEntries(owner, root, new Map([[file, 'unlink']]))
  const atomicGate = holdAtomicFlush(owner, file, removeGate)
  let afterChange
  let coalescingPassed = false
  try {
    await rm(file)
    await bounded(atomicGate.buffered, 'the real file removal enters its atomic unlink buffer', timeoutMs)
    atomicGate.assertCaptured()
    removeGate.assertCaptured()
    const change = owner.event('change', file, timeoutMs)
    await rename(replacement, file)
    await change
    assert.equal(await readFile(file, 'utf8'), contents)
    assert.equal(owner.watcher._pendingUnlinks.has(file), false, 'native re-add consumes the original atomic unlink buffer')
    afterChange = removeGate.snapshot('after-atomic-change-before-original-flush-release')
    atomicGate.release()
    await turn()
    const relative = path.relative(root, file).replaceAll('\\', '/')
    const events = owner.events.slice(boundary).filter(event => event.path === relative)
    assert.deepEqual(events.map(event => event.event), ['change'], 'atomic unlink+add still emits one change and no delayed unlink or extra add')
    assert.deepEqual(owner.errors, [])
    coalescingPassed = true
  }
  finally {
    evidence.push({ checkpoint: 'atomic-buffer-survives-remove-generation-reset', coalescingPassed, afterChange })
    atomicGate.close()
    removeGate.close()
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
