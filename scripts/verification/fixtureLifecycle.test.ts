import { expect, it, vi } from 'vitest'
import { FixtureLifecycle } from './fixtureLifecycle.ts'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

it('drains a complete work chain before cleanup and rejects its next operation', async () => {
  const lifecycle = new FixtureLifecycle()
  const entered = deferred()
  const gate = deferred()
  const events: string[] = []
  const lateOperation = vi.fn(async () => {})
  const work = lifecycle.run(async () => {
    await lifecycle.run(async () => {
      entered.resolve()
      await gate.promise
      events.push('operation finished')
    })
    try {
      await lifecycle.run(lateOperation)
    }
    finally {
      events.push('work finished')
    }
  })
  await entered.promise
  const rejected = expect(work).rejects.toThrow('Fixture is closing')
  const close = lifecycle.close()
  expect(lifecycle.close()).toBe(close)
  const cleanup = close.then(() => {
    events.push('directory removed')
  })
  expect(events).toEqual([])

  gate.resolve()
  await rejected
  await cleanup
  expect(lateOperation).not.toHaveBeenCalled()
  expect(events).toEqual(['operation finished', 'work finished', 'directory removed'])
})

it('preserves test cancellation and waits for work that has not observed it yet', async () => {
  const controller = new AbortController()
  const lifecycle = new FixtureLifecycle(controller.signal)
  const entered = deferred()
  const gate = deferred()
  const reason = new Error('test cancelled')
  const work = lifecycle.run(async () => {
    entered.resolve()
    await gate.promise
    lifecycle.signal.throwIfAborted()
  })
  await entered.promise
  const rejected = expect(work).rejects.toBe(reason)
  controller.abort(reason)
  let drained = false
  const cleanup = lifecycle.close().then(() => {
    drained = true
  })
  await Promise.resolve()
  expect(drained).toBe(false)
  gate.resolve()
  await rejected
  await cleanup
  expect(drained).toBe(true)
  await expect(lifecycle.run(async () => {})).rejects.toBe(reason)
})

it('does not start work when its test was already cancelled', async () => {
  const controller = new AbortController()
  controller.abort(new Error('already cancelled'))
  const lifecycle = new FixtureLifecycle(controller.signal)
  const work = vi.fn(async () => {})
  await expect(lifecycle.run(work)).rejects.toThrow('already cancelled')
  await lifecycle.close()
  expect(work).not.toHaveBeenCalled()
})
