import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertChunk, contractError, deferred, diagnosticGc, fixture } from './helpers.mjs'

export async function closing(rolldown, root) {
  const files = await fixture(root, 'closing')
  const entered = deferred()
  const release = deferred()
  const events = []
  const settled = []
  let inputRef
  let outputRef
  const plugin = {
    name: 'snapshot-contract-close',
    buildStart(input) { inputRef = new WeakRef(input) },
    renderStart(output) { outputRef = new WeakRef(output) },
    async closeBundle() {
      events.push('closeBundle:start')
      entered.resolve()
      await release.promise
      assert.ok(inputRef.deref())
      assert.ok(outputRef.deref())
      events.push('closeBundle:end')
    },
  }
  const bundle = await rolldown({ input: files.entry, cwd: files.cwd, plugins: [plugin], preserveEntrySignatures: 'strict' })
  const close = attempt => bundle.close().then(
    () => { settled.push({ attempt, status: 'fulfilled', hookCompleted: events.at(-1) === 'closeBundle:end' }) },
    (error) => { settled.push({ attempt, status: 'rejected', error: contractError(error) }) },
  )
  try {
    assertChunk(await bundle.generate({ format: 'es' }))
    const first = close('first')
    await entered.promise
    const second = close('concurrent')
    await diagnosticGc()
    assert.ok(inputRef.deref())
    assert.ok(outputRef.deref())
    assert.deepEqual(events, ['closeBundle:start'], 'concurrent close must not invoke the hook again')
    assert.deepEqual(settled, [], 'both close calls must remain pending until the hook is released')
    release.resolve()
    await Promise.all([first, second])
    assert.deepEqual([...settled].sort((left, right) => left.attempt.localeCompare(right.attempt)), [
      { attempt: 'concurrent', status: 'fulfilled', hookCompleted: true },
      { attempt: 'first', status: 'fulfilled', hookCompleted: true },
    ])
    await bundle.close()
    assert.equal(bundle.closed, true)
  }
  finally {
    release.resolve()
    await bundle.close()
  }
  // 官方 #11142 修复了重复 native close；包括 finally 在内的重复调用只能等待首次关闭。
  assert.deepEqual(events, ['closeBundle:start', 'closeBundle:end'])
  return { events, settled, closed: bundle.closed }
}

export async function failures(rolldown, root) {
  const files = await fixture(root, 'failures')
  const events = []
  let shouldFail = true
  const plugin = {
    name: 'snapshot-contract-failure',
    buildStart(input) {
      input.failureMarker = 'retained'
      events.push('buildStart')
    },
    transform(code) {
      if (shouldFail) {
        shouldFail = false
        throw new Error('snapshot-contract-transform-failure')
      }
      return code
    },
    renderStart(output, input) {
      assert.equal(input.failureMarker, 'retained')
      events.push('renderStart')
    },
    closeBundle() { events.push('closeBundle') },
  }
  const bundle = await rolldown({ input: files.entry, cwd: files.cwd, plugins: [plugin], preserveEntrySignatures: 'strict' })
  try {
    await assert.rejects(bundle.generate({ format: 'es' }), /snapshot-contract-transform-failure/)
    await diagnosticGc()
    assertChunk(await bundle.generate({ format: 'es' }))
    await assert.rejects(bundle.generate({ format: 'not-a-format' }))
    await diagnosticGc()
    assertChunk(await bundle.generate({ format: 'cjs' }))
  }
  finally { await bundle.close() }
  assert.equal(bundle.closed, true)
  let closeCalls = 0
  const closeEntered = deferred()
  const closeRelease = deferred()
  const rejectedClose = await rolldown({
    input: files.entry,
    cwd: files.cwd,
    plugins: [{
      name: 'snapshot-close-error',
      buildStart() {},
      async closeBundle() {
        closeCalls++
        closeEntered.resolve()
        await closeRelease.promise
        throw new Error('snapshot-contract-close-failure')
      },
    }],
  })
  await rejectedClose.generate({ format: 'es' })
  const closeOutcomes = []
  const closeAttempt = attempt => rejectedClose.close().then(
    () => { closeOutcomes.push({ attempt, status: 'fulfilled' }) },
    (error) => { closeOutcomes.push({ attempt, status: 'rejected', error: contractError(error) }) },
  )
  const pendingCloses = [closeAttempt('first')]
  try {
    await closeEntered.promise
    pendingCloses.push(closeAttempt('concurrent'))
    await diagnosticGc()
    assert.equal(closeCalls, 1, 'concurrent close must not retry the failing hook')
    assert.deepEqual(closeOutcomes, [], 'both close calls must await the failing hook')
    closeRelease.resolve()
    await Promise.all(pendingCloses)
    await closeAttempt('repeated')
  }
  finally {
    closeRelease.resolve()
    await Promise.all(pendingCloses)
    await rejectedClose.close()
  }
  assert.equal(closeCalls, 1, 'a settled failure must not cause another native close')
  // 首个调用保留完整错误；并发及后续调用仅等待首次结算，不重试也不重复传播首错。
  assert.deepEqual([...closeOutcomes].sort((left, right) => left.attempt.localeCompare(right.attempt)), [
    { attempt: 'concurrent', status: 'fulfilled' },
    {
      attempt: 'first',
      status: 'rejected',
      error: {
        name: 'Error',
        code: 'PLUGIN_ERROR',
        message: 'snapshot-contract-close-failure',
        plugin: 'snapshot-close-error',
        hook: 'closeBundle',
      },
    },
    { attempt: 'repeated', status: 'fulfilled' },
  ])
  assert.deepEqual(events, ['buildStart', 'closeBundle', 'buildStart', 'renderStart', 'buildStart', 'renderStart', 'closeBundle'])
  assert.equal(rejectedClose.closed, true)
  return { events, closeCalls, closeOutcomes, failedCloseClosed: rejectedClose.closed }
}

export async function failFast(rolldown, root) {
  const files = await fixture(root, 'fail-fast')
  const secondEntry = path.join(files.cwd, 'second.js')
  await writeFile(secondEntry, 'export const result = 7\n')
  const entered = deferred()
  const release = deferred()
  const events = []
  const callbacks = []
  let arrivals = 0
  let completed = false
  let outputRef
  const plugin = {
    name: 'snapshot-contract-fail-fast',
    renderStart(output) {
      outputRef = new WeakRef(output)
      output.marker = 'same-generation'
    },
    renderChunk(code, chunk, output) {
      const callback = { name: chunk.name, settled: false }
      events.push(`enter:${chunk.name}`)
      if (++arrivals === 2) {
        entered.resolve()
      }
      const running = (async () => {
        await entered.promise
        if (chunk.name === 'alpha') {
          throw new Error('snapshot-contract-render-failure')
        }
        await release.promise
        assert.equal(output, outputRef.deref())
        assert.equal(output.marker, 'same-generation')
        events.push(`finish:${chunk.name}`)
        completed = true
        return code
      })()
      callback.barrier = running.then(
        () => {
          callback.settled = true
          return { name: chunk.name, status: 'fulfilled' }
        },
        (error) => {
          callback.settled = true
          return { name: chunk.name, status: 'rejected', error: contractError(error) }
        },
      )
      callbacks.push(callback)
      return running
    },
  }
  const bundle = await rolldown({ input: { alpha: files.entry, beta: secondEntry }, cwd: files.cwd, plugins: [plugin], preserveEntrySignatures: 'strict' })
  const generating = bundle.generate({ format: 'es' })
  const failed = assert.rejects(generating, /snapshot-contract-render-failure/)
  let outcomes
  let failure
  let cleanupErrors
  try {
    await entered.promise
    await failed
    events.push('generate:rejected')
    await bundle.close()
    events.push('close:resolved')
    await diagnosticGc()
    events.push('gc:completed')
    release.resolve()
    events.push('callback:released')
    outcomes = await Promise.all(callbacks.map(callback => callback.barrier))
    assert.equal(arrivals, 2)
    assert.equal(callbacks.length, arrivals)
    assert.equal(callbacks.filter(callback => callback.settled).length, arrivals)
    assert.equal(completed, true, 'late callback must finish after close')
    assert.equal(outcomes.find(item => item.name === 'alpha')?.status, 'rejected')
    assert.equal(outcomes.find(item => item.name === 'alpha')?.error.message, 'snapshot-contract-render-failure')
    assert.equal(outcomes.find(item => item.name === 'beta')?.status, 'fulfilled')
    events.push('callbacks:settled')
    assert.equal(bundle.closed, true)
  }
  catch (error) {
    failure = { error }
  }
  finally {
    entered.resolve()
    release.resolve()
    const cleanup = await Promise.allSettled([failed, ...callbacks.map(callback => callback.barrier), Promise.resolve().then(() => bundle.close())])
    cleanupErrors = cleanup.filter(item => item.status === 'rejected').map(item => item.reason)
  }
  if (cleanupErrors.length) {
    throw new AggregateError(failure ? [failure.error, ...cleanupErrors] : cleanupErrors, 'Fail-fast contract cleanup failed', { cause: failure?.error })
  }
  if (failure) {
    throw failure.error
  }
  assert.deepEqual(events.slice(0, 2).sort(), ['enter:alpha', 'enter:beta'])
  assert.deepEqual(events.slice(2), [
    'generate:rejected',
    'close:resolved',
    'gc:completed',
    'callback:released',
    'finish:beta',
    'callbacks:settled',
  ])
  return { events, arrivals, completed, outcomes }
}
