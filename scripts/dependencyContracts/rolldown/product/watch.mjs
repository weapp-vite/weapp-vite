import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertChunk, deferred, fixture, hashText, runtimeResult, UnconfirmedContractCleanupError, writtenOutput } from '../helpers.mjs'

function createWatchInput(files, state) {
  let generated
  let round = 0
  return {
    input: files.entry,
    cwd: files.cwd,
    preserveEntrySignatures: 'strict',
    output: { dir: path.join(files.cwd, 'out'), format: 'es' },
    plugins: [{
      name: 'product-contract-watch',
      buildStart(input) {
        round++
        assert.deepEqual(input.input, [files.entry])
        assert.equal(input.cwd, files.cwd)
        state.events.push(`buildStart:${round}`)
      },
      renderStart(output, input) {
        assert.deepEqual(input.input, [files.entry])
        assert.equal(input.cwd, files.cwd)
        state.outputSnapshots.push({ round, format: output.format, dir: output.dir, entryFileNames: output.entryFileNames })
      },
      generateBundle(output, bundle) {
        assert.equal(output.format, 'es')
        assert.equal(output.dir, path.join(files.cwd, 'out'))
        generated = { output: Object.values(bundle) }
      },
      async writeBundle(output) {
        assert.equal(output.format, 'es')
        assert.equal(output.dir, path.join(files.cwd, 'out'))
        const chunk = assertChunk(generated)
        const written = await writtenOutput(output.dir, generated)
        const value = await runtimeResult(written.find(item => item.fileName === chunk.fileName).code, output.format)
        assert.equal(value, round === 1 ? 42 : 43)
        state.runtimeValues.push({ round, value, sha256: hashText(chunk.code), bytes: Buffer.byteLength(chunk.code), fileName: chunk.fileName })
        generated = undefined
      },
    }],
  }
}

export async function watching(watch, root) {
  const files = await fixture(root, 'product-watch')
  const finished = deferred()
  const state = { events: [], runtimeValues: [], outputSnapshots: [] }
  const changes = []
  const callbacks = new Set()
  const callbackErrors = []
  let rounds = 0
  const watcher = watch(createWatchInput(files, state))
  watcher.on('change', (id, event) => {
    changes.push({ id, event: event.event })
  })
  watcher.on('event', (event) => {
    const running = (async () => {
      if (event.code === 'ERROR') {
        const [cleanup] = await Promise.allSettled([Promise.resolve().then(() => event.result?.close())])
        if (cleanup.status === 'rejected') {
          throw new AggregateError([event.error, cleanup.reason], 'Failed watch result cleanup failed', { cause: event.error })
        }
        throw event.error
      }
      if (event.code !== 'BUNDLE_END') {
        return
      }
      await event.result.close()
      rounds++
      state.events.push(`bundleEnd:${rounds}`)
      if (rounds === 1) {
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
    // 公共事件监听器返回本轮 Promise，关闭与源码编辑均在本轮完成。
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
    throw new UnconfirmedContractCleanupError(errors, 'Public watch cleanup did not confirm native watcher termination', { cause: failure?.error ?? closeFailure.error })
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Public watch contract failed', { cause: failure?.error })
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
  const diagnostics = { expectedDependency: files.dependency, expectedPhysicalDependency: expectedDependency, nativeNotifications: changes, inspectedNotifications }
  assert.equal(dependencyChangeObserved, true, `Dependency notification was not observed: ${JSON.stringify(diagnostics)}`)
  return { rounds, ...state, dependencyChangeObserved, diagnostics }
}

export async function scanning(scan, root) {
  const files = await fixture(root, 'product-scan')
  let options
  let closed = false
  await scan({
    input: files.entry,
    cwd: files.cwd,
    plugins: [{
      name: 'product-contract-scan',
      buildStart(input) {
        options = { input: [...input.input], cwd: input.cwd }
      },
      closeBundle() {
        closed = true
      },
    }],
  })
  assert.equal(closed, true)
  assert.deepEqual(options, { input: [files.entry], cwd: files.cwd })
  return { closed, ...options }
}
