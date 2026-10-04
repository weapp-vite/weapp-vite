import type { Serializable } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { createWorkerLifecycle } from './workerLifecycle'

class FakeHost extends EventEmitter {
  connected = true
  events: string[] = []
  send = vi.fn((_message: Serializable, callback: (error: Error | null) => void) => {
    this.events.push('send')
    callback(null)
    return true
  })

  exit = vi.fn((code: number) => {
    this.events.push(`exit:${code}`)
  })

  disconnect = vi.fn(() => {
    this.events.push('disconnect')
    this.drop()
  })

  drop() {
    this.connected = false
    this.emit('disconnect')
  }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

async function settle() {
  await Promise.resolve()
  await Promise.resolve()
}

it('disposes an idle disconnected worker once and removes its disconnect listener', async () => {
  const host = new FakeHost()
  const lifecycle = createWorkerLifecycle(host)
  const dispose = vi.fn(() => {
    host.events.push('dispose')
  })
  lifecycle.setDispose(dispose)
  host.drop()
  host.drop()
  await settle()
  expect(host.events).toEqual(['dispose', 'exit:0'])
  expect(dispose).toHaveBeenCalledOnce()
  expect(host.exit).toHaveBeenCalledOnce()
  expect(host.listenerCount('disconnect')).toBe(0)
  expect(host.disconnect).not.toHaveBeenCalled()
})

it('waits for active compilation finally cleanup before disposing and rejects new work after disconnect', async () => {
  const host = new FakeHost()
  const lifecycle = createWorkerLifecycle(host)
  const compilation = deferred()
  lifecycle.setDispose(() => {
    host.events.push('dispose')
  })
  const running = lifecycle.run(async () => {
    try {
      await compilation.promise
    }
    finally {
      host.events.push('compile-finally')
    }
  })
  host.drop()
  const next = vi.fn()
  await lifecycle.run(next)
  expect(next).not.toHaveBeenCalled()
  expect(host.events).toEqual([])
  compilation.resolve()
  await running
  expect(host.events).toEqual(['compile-finally', 'dispose', 'exit:0'])
})

it('retains startup ownership until the loader registers its cleanup after an asynchronous installation', async () => {
  const host = new FakeHost()
  const lifecycle = createWorkerLifecycle(host)
  const installation = deferred()
  const starting = lifecycle.run(async () => {
    await installation.promise
    lifecycle.setDispose(() => {
      host.events.push('dispose')
    })
    host.events.push('startup-finally')
  })
  host.drop()
  await settle()
  expect(host.exit).not.toHaveBeenCalled()
  installation.resolve()
  await starting
  expect(host.events).toEqual(['startup-finally', 'dispose', 'exit:0'])
})

it('does not start loader installation when the IPC channel is already disconnected', async () => {
  const host = new FakeHost()
  host.connected = false
  const lifecycle = createWorkerLifecycle(host)
  const install = vi.fn()
  await lifecycle.run(install)
  await expect(lifecycle.send({ kind: 'ready' })).resolves.toBe(false)
  expect(install).not.toHaveBeenCalled()
  expect(host.send).not.toHaveBeenCalled()
  expect(host.exit).toHaveBeenCalledExactlyOnceWith(0)
})

it.each(['callback', 'throw'] as const)('handles %s IPC send failure without disposing an active request prematurely', async (mode) => {
  const host = new FakeHost()
  const reportError = vi.fn()
  const lifecycle = createWorkerLifecycle(host, reportError)
  const compilation = deferred()
  const failure = new Error('IPC channel closed during send')
  lifecycle.setDispose(() => {
    host.events.push('dispose')
  })
  host.send.mockImplementationOnce((_message, callback) => {
    if (mode === 'throw') {
      throw failure
    }
    callback(failure)
    return false
  })
  const running = lifecycle.run(async () => {
    await expect(lifecycle.send({ kind: 'result' })).resolves.toBe(false)
    try {
      await compilation.promise
    }
    finally {
      host.events.push('compile-finally')
    }
  })
  await settle()
  expect(host.events).toEqual([])
  expect(reportError).toHaveBeenCalledExactlyOnceWith(failure)
  compilation.resolve()
  await running
  expect(host.events).toEqual(['compile-finally', 'dispose', 'disconnect', 'exit:1'])
})

it('finishes request cleanup and loader disposal before flushing the close acknowledgement and exiting', async () => {
  const host = new FakeHost()
  const lifecycle = createWorkerLifecycle(host)
  const response = { id: 7, kind: 'closed' }
  let sent: ((error: Error | null) => void) | undefined
  host.send.mockImplementationOnce((_message, callback) => {
    host.events.push('send')
    sent = callback
    return true
  })
  lifecycle.setDispose(() => {
    host.events.push('dispose')
  })
  const closing = lifecycle.run(() => {
    try {
      lifecycle.close(response)
    }
    finally {
      host.events.push('request-finally')
    }
  })
  await settle()
  expect(host.events).toEqual(['request-finally', 'dispose', 'send'])
  expect(host.send).toHaveBeenCalledWith(response, expect.any(Function))
  expect(host.exit).not.toHaveBeenCalled()
  sent!(null)
  await closing
  expect(host.events).toEqual(['request-finally', 'dispose', 'send', 'disconnect', 'exit:0'])
})

it('reports disposal failure and exits unsuccessfully without acknowledging a clean shutdown', async () => {
  const host = new FakeHost()
  const reportError = vi.fn()
  const lifecycle = createWorkerLifecycle(host, reportError)
  const failure = new Error('Loader cleanup failed')
  lifecycle.setDispose(() => {
    throw failure
  })
  lifecycle.close({ id: 1, kind: 'closed' })
  await settle()
  expect(reportError).toHaveBeenCalledExactlyOnceWith(failure)
  expect(host.send).not.toHaveBeenCalled()
  expect(host.events).toEqual(['disconnect', 'exit:1'])
})

it('keeps cleanup deferred until the active request finally runs even when that request rejects', async () => {
  const host = new FakeHost()
  const lifecycle = createWorkerLifecycle(host)
  const compilation = deferred()
  const failure = new Error('Compilation failed')
  lifecycle.setDispose(() => {
    host.events.push('dispose')
  })
  const running = lifecycle.run(async () => {
    try {
      await compilation.promise
      throw failure
    }
    finally {
      host.events.push('compile-finally')
    }
  })
  const rejected = expect(running).rejects.toBe(failure)
  host.drop()
  compilation.resolve()
  await rejected
  expect(host.events).toEqual(['compile-finally', 'dispose', 'exit:0'])
})
