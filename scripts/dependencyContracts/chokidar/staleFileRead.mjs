import assert from 'node:assert/strict'
import { access, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { holdRemoveEntries } from './removeCooldown.mjs'
import { bounded, deferred, turn, waitForObservedEventPhase } from './support.mjs'

export function createStaleFileReadGate(file) {
  const entered = deferred()
  const allowNativeStat = deferred()
  const nativeResultSeen = deferred()
  const releaseNativeError = deferred()
  const returned = deferred()
  let armed = false
  let used = false
  let nativeError
  let thrownError
  let unexpectedNativeSuccess = false
  return {
    file,
    entered: entered.promise,
    nativeResultSeen: nativeResultSeen.promise,
    returned: returned.promise,
    get nativeError() { return nativeError },
    get sameNativeErrorReleased() { return nativeError != null && nativeError === thrownError },
    get unexpectedNativeSuccess() { return unexpectedNativeSuccess },
    arm() { armed = true },
    runNativeStat() { allowNativeStat.resolve() },
    releaseError() { releaseNativeError.resolve() },
    releaseAll() {
      allowNativeStat.resolve()
      releaseNativeError.resolve()
    },
    async hook({ file: attempted, original }) {
      if (!armed || used || attempted !== file) {
        return original()
      }
      used = true
      entered.resolve()
      await allowNativeStat.promise
      try {
        const result = await original()
        unexpectedNativeSuccess = true
        nativeResultSeen.resolve()
        returned.resolve()
        return result
      }
      catch (error) {
        nativeError = error
        nativeResultSeen.resolve()
        await releaseNativeError.promise
        thrownError = error
        returned.resolve()
        throw error
      }
    },
  }
}

export async function verifyStaleFileRead({ chokidar, root, watched, timeoutMs, open, ready, evidence, gate }) {
  const file = gate.file
  await writeFile(file, 'old file generation')
  const owner = open(chokidar, watched, { atomic: false })
  await ready(owner)
  const removeGate = holdRemoveEntries(owner, root, new Map([[file, 'unlink']]))
  let afterAdd
  let lateFailurePassed = false
  let errorBoundary
  try {
    gate.arm()
    await writeFile(file, 'old native listener enters an armed exact stat')
    await bounded(gate.entered, 'old file listener reaches its exact native stat gate', timeoutMs)
    const removed = owner.event('unlink', file, timeoutMs)
    await rm(file)
    await removed
    removeGate.assertCaptured()
    await assert.rejects(access(file), { code: 'ENOENT' })
    gate.runNativeStat()
    await bounded(gate.nativeResultSeen, 'held old listener receives a real native ENOENT', timeoutMs)
    assert.equal(gate.unexpectedNativeSuccess, false, 'the held rejection must come from a real missing-path stat')
    assert.equal(gate.nativeError?.code, 'ENOENT')
    assert.equal(gate.nativeError?.syscall, 'stat')
    assert.equal(path.resolve(String(gate.nativeError?.path)), file)
    evidence.push({ checkpoint: 'real-old-file-stat-enoent-held', passed: true, errorIdentity: 'held-native-stat-error-1' })

    const add = owner.event('add', file, timeoutMs)
    await writeFile(file, 'replacement file while the original native ENOENT is held')
    await add
    afterAdd = removeGate.snapshot('after-replacement-add-before-old-enoent-release')
    errorBoundary = owner.events.length
    gate.releaseError()
    await bounded(gate.returned, 'same native ENOENT rejected back to the old file listener', timeoutMs)
    await turn()
    const sentinel = path.join(watched, 'stale-file-event-barrier.txt')
    const sentinelAdded = owner.event('add', sentinel, timeoutMs)
    await writeFile(sentinel, 'public parent scan barrier after the stale rejection')
    await sentinelAdded
    await turn()
    await access(file)
    assert.equal(await readFile(file, 'utf8'), 'replacement file while the original native ENOENT is held')

    await waitForObservedEventPhase(owner, file, evidence, timeoutMs)
    const change = owner.event('change', file, timeoutMs)
    await writeFile(file, 'replacement remains native-watchable after the old listener fails')
    await change
    const relative = path.relative(root, file).replaceAll('\\', '/')
    const afterError = owner.events.slice(errorBoundary).filter(event => event.path === relative)
    assert.equal(afterError.some(event => event.event === 'unlink'), false, 'an old native ENOENT cannot unlink a live replacement file')
    assert.equal(afterError.some(event => event.event === 'add'), false, 'a stale listener cannot remove and silently rediscover the replacement generation')
    assert.equal(gate.sameNativeErrorReleased, true, 'the original native Error is released unchanged')
    assert.deepEqual(owner.errors, [])
    lateFailurePassed = true
  }
  finally {
    gate.releaseAll()
    evidence.push({
      checkpoint: 'old-file-listener-cannot-remove-replacement-generation',
      lateFailurePassed,
      afterAdd,
      sameNativeErrorReleased: gate.sameNativeErrorReleased,
      nativeError: gate.nativeError && { code: gate.nativeError.code, syscall: gate.nativeError.syscall },
      afterErrorEvents: errorBoundary == null ? [] : owner.events.slice(errorBoundary),
      beforeGateCleanup: removeGate.snapshot('before-stale-file-gate-cleanup'),
    })
    removeGate.close()
  }
}
