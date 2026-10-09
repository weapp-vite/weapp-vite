import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertChunk, deferred, diagnosticGc, fixture, hashText, runtimeResult, UnconfirmedContractCleanupError, writtenOutput } from './helpers.mjs'

function createWatchPlugin(state, observations) {
  let savedInput
  let savedOutput
  let generated
  return {
    name: 'snapshot-contract-watch',
    buildStart(input) {
      if (savedInput) {
        assert.equal(input, savedInput)
      }
      else {
        savedInput = input
        observations.input = new WeakRef(input)
      }
      input.marker = (input.marker ?? 0) + 1
      state.events.push(`buildStart:${input.marker}`)
    },
    renderStart(output, input) {
      assert.equal(input, savedInput)
      if (savedOutput) {
        assert.equal(output, savedOutput)
      }
      else {
        savedOutput = output
        observations.output = new WeakRef(output)
      }
      output.marker = input.marker
      state.outputSnapshots.push({ round: input.marker, format: output.format, dir: output.dir, entryFileNames: output.entryFileNames })
    },
    generateBundle(output, bundle) {
      assert.equal(output, savedOutput)
      assert.ok(output.marker >= 1)
      generated = { output: Object.values(bundle) }
    },
    async writeBundle(output) {
      assert.equal(output, savedOutput)
      const chunk = assertChunk(generated)
      const written = await writtenOutput(output.dir, generated)
      const expected = output.marker === 1 ? 42 : 43
      const value = await runtimeResult(written.find(item => item.fileName === chunk.fileName).code, output.format)
      assert.equal(value, expected)
      state.runtimeValues.push({ round: output.marker, value, sha256: hashText(chunk.code), bytes: Buffer.byteLength(chunk.code), fileName: chunk.fileName })
      generated = undefined
    },
  }
}

function createWatchInput(files, state, observations) {
  const sentinel = { label: 'watch-owner' }
  observations.sentinel = new WeakRef(sentinel)
  return {
    input: files.entry,
    cwd: files.cwd,
    plugins: [createWatchPlugin(state, observations)],
    preserveEntrySignatures: 'strict',
    output: { dir: path.join(files.cwd, 'out'), format: 'es' },
    onLog(level, log, defaultHandler) {
      assert.equal(sentinel.label, 'watch-owner')
      defaultHandler(level, log)
    },
  }
}

async function watchLifecycle(watch, root, observations) {
  const files = await fixture(root, 'watch')
  const finished = deferred()
  const state = { events: [], runtimeValues: [], outputSnapshots: [] }
  const changes = []
  const callbacks = new Set()
  const callbackErrors = []
  let rounds = 0
  const watcher = watch(createWatchInput(files, state, observations))
  watcher.on('change', (id, event) => {
    changes.push({ id, event: event.event })
  })
  watcher.on('event', (event) => {
    const running = (async () => {
      if (event.code === 'ERROR') {
        await event.result?.close()
        throw event.error
      }
      if (event.code !== 'BUNDLE_END') {
        return
      }
      await event.result.close()
      rounds++
      state.events.push(`bundleEnd:${rounds}`)
      if (rounds === 1) {
        await diagnosticGc()
        await writeFile(files.dependency, 'export const value = 42\n')
      }
      else {
        finished.resolve()
      }
    })()
    const settled = running.catch((error) => {
      callbackErrors.push(error)
      finished.reject(error)
    })
    callbacks.add(settled)
    // Rolldown 等待 listener 返回的 Promise，确保关闭本轮与源码编辑先完成。
    return settled.then(() => callbacks.delete(settled))
  })
  let failure
  let closeFailure
  try {
    await finished.promise
  }
  catch (error) {
    failure = { error }
  }
  finally {
    try {
      await watcher.close()
    }
    catch (error) {
      closeFailure = { error }
    }
    await Promise.all(callbacks)
  }
  const errors = [...new Set([
    ...failure ? [failure.error] : [],
    ...closeFailure ? [closeFailure.error] : [],
    ...callbackErrors,
  ])]
  if (closeFailure) {
    throw new UnconfirmedContractCleanupError(errors, 'Watch cleanup did not confirm native watcher termination', { cause: failure?.error ?? closeFailure.error })
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Watch contract failed', { cause: failure?.error })
  }
  assert.equal(rounds, 2)
  assert.deepEqual(state.events, ['buildStart:1', 'bundleEnd:1', 'buildStart:2', 'bundleEnd:2'])
  assert.deepEqual(state.runtimeValues.map(item => item.value), [42, 43])
  assert.deepEqual(state.outputSnapshots.map(item => item.format), ['es', 'es'])
  assert.deepEqual(state.outputSnapshots.map(item => item.dir), [path.join(files.cwd, 'out'), path.join(files.cwd, 'out')])
  const expectedDependency = await realpath(files.dependency)
  const inspectedNotifications = await Promise.all(changes.map(async (change) => {
    try {
      return { ...change, physicalPath: await realpath(change.id) }
    }
    catch (error) {
      return { ...change, inspectionError: String(error) }
    }
  }))
  const dependencyChangeObserved = inspectedNotifications.some(change => change.physicalPath && path.relative(change.physicalPath, expectedDependency) === '')
  const diagnostics = {
    expectedDependency: files.dependency,
    expectedPhysicalDependency: expectedDependency,
    nativeNotifications: changes,
    inspectedNotifications,
  }
  assert.equal(dependencyChangeObserved, true, `Dependency notification was not observed: ${JSON.stringify(diagnostics)}`)
  return { rounds, ...state, dependencyChangeObserved, diagnostics }
}

export async function watching(watch, root) {
  const observations = {}
  // 生命周期函数只返回 WeakRef 与纯数据，避免检查代码自身延长 watcher/options 的存活期。
  const result = await watchLifecycle(watch, root, observations)
  await diagnosticGc()
  const liveAfterClose = Object.fromEntries(['input', 'output', 'sentinel'].map((kind) => {
    assert.ok(observations[kind], `Watch did not observe ${kind}`)
    return [kind, observations[kind].deref() !== undefined]
  }))
  assert.deepEqual(liveAfterClose, { input: false, output: false, sentinel: false }, 'Closed watch retained options or logger owner')
  return { ...result, liveAfterClose }
}

export async function scanning(scan, root) {
  const files = await fixture(root, 'scan')
  let options
  let closed = false
  await scan({
    input: files.entry,
    cwd: files.cwd,
    plugins: [{
      name: 'snapshot-contract-scan',
      buildStart(input) {
        options = input
      },
      closeBundle() {
        closed = true
      },
    }],
  })
  await diagnosticGc()
  assert.equal(closed, true)
  assert.deepEqual(options.input, [files.entry])
  assert.equal(options.cwd, files.cwd)
  return { closed, input: options.input }
}
