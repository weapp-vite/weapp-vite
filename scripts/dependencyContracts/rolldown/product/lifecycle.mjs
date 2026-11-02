import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setImmediate as nextTask } from 'node:timers/promises'
import { assertChunk, contractError, deferred, fixture, outputCode, runtimeResult } from '../helpers.mjs'
import { withBundle } from './support.mjs'

export async function closing(rolldown, root) {
  const files = await fixture(root, 'product-close')
  const entered = deferred()
  const release = deferred()
  const events = []
  const settled = []
  const pending = []
  const observations = await withBundle(rolldown, {
    input: files.entry,
    cwd: files.cwd,
    preserveEntrySignatures: 'strict',
    plugins: [{
      name: 'product-contract-close',
      async closeBundle() {
        events.push('closeBundle:start')
        entered.resolve()
        await release.promise
        events.push('closeBundle:end')
      },
    }],
  }, async (bundle) => {
    const close = attempt => bundle.close().then(
      () => { settled.push({ attempt, status: 'fulfilled', hookCompleted: events.at(-1) === 'closeBundle:end' }) },
      (error) => { settled.push({ attempt, status: 'rejected', error: contractError(error) }) },
    )
    try {
      assertChunk(await bundle.generate({ format: 'es' }))
      pending.push(close('first'))
      await entered.promise
      pending.push(close('concurrent'))
      await nextTask()
      assert.deepEqual(events, ['closeBundle:start'], 'concurrent close must not invoke the hook again')
      assert.deepEqual(settled, [], 'both close calls must remain pending until the hook is released')
      release.resolve()
      await Promise.all(pending)
      assert.deepEqual([...settled].sort((left, right) => left.attempt.localeCompare(right.attempt)), [
        { attempt: 'concurrent', status: 'fulfilled', hookCompleted: true },
        { attempt: 'first', status: 'fulfilled', hookCompleted: true },
      ])
      await bundle.close()
      assert.equal(bundle.closed, true)
      return { events, settled, closed: bundle.closed }
    }
    finally {
      release.resolve()
      await Promise.all(pending)
    }
  })
  assert.deepEqual(events, ['closeBundle:start', 'closeBundle:end'])
  return observations
}

async function failingClose(rolldown, files) {
  let closeCalls = 0
  const entered = deferred()
  const release = deferred()
  const closeOutcomes = []
  const pending = []
  return withBundle(rolldown, {
    input: files.entry,
    cwd: files.cwd,
    plugins: [{
      name: 'snapshot-close-error',
      async closeBundle() {
        closeCalls++
        entered.resolve()
        await release.promise
        throw new Error('snapshot-contract-close-failure')
      },
    }],
  }, async (bundle) => {
    const close = attempt => bundle.close().then(
      () => { closeOutcomes.push({ attempt, status: 'fulfilled' }) },
      (error) => { closeOutcomes.push({ attempt, status: 'rejected', error: contractError(error) }) },
    )
    try {
      await bundle.generate({ format: 'es' })
      pending.push(close('first'))
      await entered.promise
      pending.push(close('concurrent'))
      await nextTask()
      assert.equal(closeCalls, 1, 'concurrent close must not retry the failing hook')
      assert.deepEqual(closeOutcomes, [], 'both close calls must await the failing hook')
      release.resolve()
      await Promise.all(pending)
      await close('repeated')
      assert.equal(closeCalls, 1, 'a settled failure must not cause another native close')
      // 首错、并发等待与重复调用的公开结果保持原契约，不以宽泛失败替代。
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
      assert.equal(bundle.closed, true)
      return { closeCalls, closeOutcomes, closed: bundle.closed }
    }
    finally {
      release.resolve()
      await Promise.all(pending)
    }
  })
}

export async function failures(rolldown, root) {
  const files = await fixture(root, 'product-errors')
  const events = []
  let shouldFail = true
  const recovered = await withBundle(rolldown, {
    input: files.entry,
    cwd: files.cwd,
    preserveEntrySignatures: 'strict',
    plugins: [{
      name: 'product-contract-errors',
      buildStart(input) {
        assert.deepEqual(input.input, [files.entry])
        assert.equal(input.cwd, files.cwd)
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
        assert.deepEqual(input.input, [files.entry])
        assert.equal(input.cwd, files.cwd)
        events.push('renderStart')
      },
      closeBundle() { events.push('closeBundle') },
    }],
  }, async (bundle) => {
    await assert.rejects(bundle.generate({ format: 'es' }), /snapshot-contract-transform-failure/)
    const output = await bundle.generate({ format: 'es' })
    const runtimeValue = await runtimeResult(assertChunk(output).code, 'es')
    assert.equal(runtimeValue, 42)
    await assert.rejects(bundle.generate({ format: 'not-a-format' }))
    const finalOutput = await bundle.generate({ format: 'cjs' })
    assertChunk(finalOutput)
    return { runtimeValue, formats: ['es', 'cjs'], output: outputCode(finalOutput).map(({ code, ...item }) => item) }
  })
  assert.deepEqual(events, ['buildStart', 'closeBundle', 'buildStart', 'renderStart', 'buildStart', 'renderStart', 'closeBundle'])
  return { events, recovered, failingClose: await failingClose(rolldown, files) }
}

export async function inflightError(rolldown, root) {
  const files = await fixture(root, 'product-inflight-error')
  const secondEntry = path.join(files.cwd, 'second.js')
  await writeFile(secondEntry, 'export const result = 7\n')
  const entered = deferred()
  const release = deferred()
  const events = []
  const callbacks = []
  let arrivals = 0
  let completed = false
  const result = await withBundle(rolldown, {
    input: { alpha: files.entry, beta: secondEntry },
    cwd: files.cwd,
    preserveEntrySignatures: 'strict',
    plugins: [{
      name: 'product-contract-inflight-error',
      renderChunk(code, chunk, output) {
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
          assert.equal(output.format, 'es')
          events.push(`finish:${chunk.name}`)
          completed = true
          return code
        })()
        callbacks.push(running.then(
          () => ({ name: chunk.name, status: 'fulfilled' }),
          error => ({ name: chunk.name, status: 'rejected', error: contractError(error) }),
        ))
        return running
      },
    }],
  }, async (bundle) => {
    const generating = bundle.generate({ format: 'es' }).then(
      () => ({ status: 'fulfilled' }),
      error => ({ status: 'rejected', error: contractError(error) }),
    )
    try {
      await entered.promise
      const failure = await generating
      assert.equal(failure.status, 'rejected')
      assert.match(failure.error.message, /snapshot-contract-render-failure/)
      events.push('generate:rejected')
      await bundle.close()
      events.push('close:resolved')
      assert.equal(bundle.closed, true)
      assert.equal(completed, false, 'The sibling callback must remain gated until after public close completes')
      release.resolve()
      events.push('callback:released')
      const outcomes = await Promise.all(callbacks)
      assert.equal(arrivals, 2)
      assert.equal(callbacks.length, arrivals)
      assert.equal(completed, true)
      assert.equal(outcomes.find(item => item.name === 'alpha')?.status, 'rejected')
      assert.equal(outcomes.find(item => item.name === 'alpha')?.error.message, 'snapshot-contract-render-failure')
      assert.equal(outcomes.find(item => item.name === 'beta')?.status, 'fulfilled')
      return { events, arrivals, completed, failure, outcomes, closed: bundle.closed }
    }
    finally {
      entered.resolve()
      release.resolve()
      await Promise.all([generating, ...callbacks])
    }
  })
  assert.deepEqual(events.slice(0, 2).sort(), ['enter:alpha', 'enter:beta'])
  assert.equal(events.filter(event => event === 'finish:beta').length, 1)
  assert.deepEqual(events.slice(2), ['generate:rejected', 'close:resolved', 'callback:released', 'finish:beta'])
  return result
}
