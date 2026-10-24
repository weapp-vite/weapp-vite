import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createSharedStatGate } from './sharedStatGate.mjs'
import { createStaleFileReadGate } from './staleFileRead.mjs'
import { bounded, deferred, installNativeInstrumentation, observeWatcher } from './support.mjs'

export const timeoutMs = 8000

export function createContext(scenario, root) {
  const watched = path.join(root, 'src')
  const target = scenario.scope === 'root' ? watched : path.join(watched, 'extra')
  const image = path.join(target, 'image.txt')
  const stable = path.join(watched, 'stable')
  const stableFile = path.join(stable, 'stable.txt')
  const sharedBoundaryFile = path.join(root, 'shared-boundary.txt')
  const statChild = path.join(watched, 'extra', 'deep', 'held.txt')
  const observations = []
  const scenarioEvidence = []
  const gates = []
  let instrumentation
  let injected = 0
  let injectedError
  let probeErrorCount = 0

  const gate = () => {
    const entered = deferred()
    const release = deferred()
    const returned = deferred()
    const item = { entered, release, returned, used: false }
    gates.push(item)
    return item
  }

  const heldRead = gate()
  const heldStat = gate()
  const heldReplacementRead = gate()
  let replacementReadArmed = false
  const staleFileReadGate = createStaleFileReadGate(path.join(watched, 'stale-listener.txt'))
  const sharedStatGate = createSharedStatGate(sharedBoundaryFile)

  async function prepare() {
    await mkdir(target, { recursive: true })
    if (scenario.kind === 'replacement-read') {
      await writeFile(path.join(target, 'old-only.txt'), 'old generation only')
    }
    else { await writeFile(image, 'initial image') }
    if (scenario.kind === 'close' || scenario.kind === 'remove-during-stat') {
      await mkdir(path.dirname(statChild), { recursive: true })
      await writeFile(statChild, 'stat captured before close or parent deletion')
    }
    if (scenario.kind.startsWith('shared')) {
      await mkdir(stable, { recursive: true })
      await writeFile(stableFile, 'first shared value')
    }
    if (scenario.depth != null) {
      await mkdir(path.join(target, 'beyond-depth'), { recursive: true })
      await writeFile(path.join(target, 'beyond-depth', 'not-observed.txt'), 'too deep')
      await writeFile(path.join(watched, 'preexisting.txt'), 'initial file is ignored')
    }
  }

  function install() {
    const isInjected = ['recover', 'classify', 'shared-failure'].includes(scenario.kind)
    const hooks = {}
    if (scenario.kind === 'shared-inode-late-error') {
      hooks.stat = sharedStatGate.hook
    }
    if (scenario.kind === 'stale-file-read') {
      hooks.stat = staleFileReadGate.hook
    }
    if (scenario.kind === 'replacement-read') {
      hooks.readdir = async ({ file, original }) => {
        const result = await original()
        if (file === target && replacementReadArmed && !heldReplacementRead.used) {
          heldReplacementRead.used = true
          heldReplacementRead.entered.resolve()
          await heldReplacementRead.release.promise
          heldReplacementRead.resultReturned = true
          heldReplacementRead.returned.resolve()
        }
        return result
      }
    }
    if (scenario.kind === 'close' && scenario.block === 'readdir') {
      hooks.readdir = async ({ file, original }) => {
        const result = await original()
        if (file === watched && !heldRead.used) {
          heldRead.used = true
          heldRead.entered.resolve()
          await heldRead.release.promise
          heldRead.returned.resolve()
        }
        return result
      }
    }
    if ((scenario.kind === 'close' && scenario.block === 'stat') || scenario.kind === 'remove-during-stat') {
      hooks.stat = async ({ file, original }) => {
        const result = await original()
        if (file === statChild && !heldStat.used) {
          heldStat.used = true
          heldStat.entered.resolve()
          await heldStat.release.promise
          heldStat.returned.resolve()
        }
        return result
      }
    }
    if (scenario.probeError) {
      hooks.lstat = async ({ file, original }) => {
        if (injected && file === target && probeErrorCount === 0) {
          probeErrorCount++
          throw Object.assign(new Error('presence probe denied'), { code: 'EACCES', syscall: 'lstat', path: target })
        }
        return original()
      }
    }
    instrumentation = installNativeInstrumentation({
      root,
      platform: scenario.platform,
      promiseHooks: hooks,
      beforeWatch(file) {
        if (!isInjected || file !== target || injected) {
          return
        }
        injected++
        if (scenario.remove !== false) {
          fs.rmSync(target, { recursive: true })
        }
        injectedError = Object.assign(new Error('exact directory native registration failure'), {
          code: scenario.code || 'EPERM',
          syscall: scenario.syscall || 'watch',
          path: scenario.wrongPath === 'case-only'
            ? path.join(path.dirname(target), path.basename(target).toUpperCase())
            : scenario.wrongPath ? path.join(root, 'different-directory') : target,
        })
        throw injectedError
      },
    })
  }

  function open(chokidar, paths = watched, options) {
    const owner = observeWatcher(chokidar, root, paths, options)
    observations.push(owner)
    return owner
  }

  async function ready(owner) {
    await bounded(owner.ready, 'public ready', timeoutMs)
    assert.equal(owner.readyCount, 1, 'initialization must publish ready exactly once')
  }

  return {
    scenario,
    root,
    watched,
    target,
    image,
    stable,
    stableFile,
    sharedBoundaryFile,
    statChild,
    timeoutMs,
    observations,
    scenarioEvidence,
    gates,
    heldRead,
    heldStat,
    heldReplacementRead,
    staleFileReadGate,
    sharedStatGate,
    prepare,
    install,
    open,
    ready,
    armReplacementRead() { replacementReadArmed = true },
    get instrumentation() { return instrumentation },
    get injected() { return injected },
    get injectedError() { return injectedError },
    get probeErrorCount() { return probeErrorCount },
  }
}
