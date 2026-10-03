import type { MiniProgramArtifact } from '@mpcore/test'
import type { VitestPluginContext } from 'vitest/node'
import { describe, expect, it, vi } from 'vitest'
import { mpcoreTest } from './config'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function runner(watch: boolean) {
  let close!: () => Promise<void>
  const project = { provide: vi.fn() }
  const specs = [{ project }, { project: {} }]
  const vitest = {
    config: { watch },
    onClose: vi.fn((cleanup) => { close = cleanup }),
    globTestSpecifications: vi.fn(async () => specs),
    rerunTestSpecifications: vi.fn(async () => undefined),
    state: { catchError: vi.fn() },
    logger: { printError: vi.fn() },
  }
  return { context: { project, vitest } as unknown as VitestPluginContext, project, vitest, specs, close: () => close() }
}

const artifact: MiniProgramArtifact = { projectPath: 'fixture' }

describe('runner-owned mpcore artifacts', () => {
  it('builds once in run mode and provides the artifact without starting a watcher', async () => {
    const host = runner(false)
    const build = vi.fn(async () => artifact)
    const watch = vi.fn()
    const plugin = mpcoreTest({ artifact: { build, watch } })
    await plugin.configureVitest(host.context)
    expect(build).toHaveBeenCalledOnce()
    expect(watch).not.toHaveBeenCalled()
    expect(host.project.provide).toHaveBeenCalledWith('mpcoreArtifact', artifact)
    await host.close()
  })

  it('uses one watcher build and reruns only this project after publishing its new artifact', async () => {
    const host = runner(true)
    const build = vi.fn(async () => artifact)
    const close = vi.fn(async () => undefined)
    let callbacks!: { onRebuilt: (artifact: MiniProgramArtifact) => Promise<void>, onError: (error: unknown) => void }
    const plugin = mpcoreTest({ artifact: { build, watch: async (hooks) => {
      callbacks = hooks
      return { artifact, close }
    } } })
    await plugin.configureVitest(host.context)
    expect(build).not.toHaveBeenCalled()
    const updated = { projectPath: 'updated-fixture' }
    await callbacks.onRebuilt(updated)
    expect(host.project.provide).toHaveBeenLastCalledWith('mpcoreArtifact', updated)
    expect(host.vitest.rerunTestSpecifications).toHaveBeenCalledWith([host.specs[0]])
    const error = new Error('artifact compilation failed')
    callbacks.onError(error)
    expect(host.vitest.state.catchError).toHaveBeenCalledWith(error, 'Mpcore Artifact Error')
    expect(host.vitest.logger.printError).toHaveBeenCalledWith(error)
    await host.close()
    await host.close()
    expect(close).toHaveBeenCalledOnce()
    await callbacks.onRebuilt(artifact)
    expect(host.vitest.rerunTestSpecifications).toHaveBeenCalledTimes(1)
  })

  it('waits for asynchronous startup on close and releases the late watcher without publishing', async () => {
    const host = runner(true)
    const started = deferred<void>()
    const finish = deferred<void>()
    const close = vi.fn(async () => undefined)
    const plugin = mpcoreTest({ artifact: { build: async () => artifact, watch: async () => {
      started.resolve()
      await finish.promise
      return { artifact, close }
    } } })
    const configuring = plugin.configureVitest(host.context)
    await started.promise
    let closed = false
    const closing = host.close().then(() => {
      closed = true
    })
    await Promise.resolve()
    expect(closed).toBe(false)
    finish.resolve()
    await Promise.all([configuring, closing])
    expect(close).toHaveBeenCalledOnce()
    expect(host.project.provide).not.toHaveBeenCalled()
  })

  it('drains an in-flight callback without rerunning tests after close begins', async () => {
    const host = runner(true)
    const selected = deferred<void>()
    const finish = deferred<typeof host.specs>()
    host.vitest.globTestSpecifications.mockImplementation(async () => {
      selected.resolve()
      return finish.promise
    })
    let rebuild!: (artifact: MiniProgramArtifact) => Promise<void>
    const close = vi.fn(async () => undefined)
    const plugin = mpcoreTest({ artifact: { build: async () => artifact, watch: async ({ onRebuilt }) => {
      rebuild = onRebuilt
      return { artifact, close }
    } } })
    await plugin.configureVitest(host.context)
    const rebuilding = rebuild({ projectPath: 'next' })
    await selected.promise
    const closing = host.close()
    finish.resolve(host.specs)
    await Promise.all([rebuilding, closing])
    expect(host.vitest.rerunTestSpecifications).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })

  it('publishes an update received during startup without deadlocking the watcher factory', async () => {
    const host = runner(true)
    const updated = { projectPath: 'updated-during-startup' }
    const plugin = mpcoreTest({ artifact: { build: async () => artifact, watch: async ({ onRebuilt }) => {
      await onRebuilt(updated)
      return { artifact, close: vi.fn() }
    } } })
    await plugin.configureVitest(host.context)
    expect(host.project.provide).toHaveBeenCalledExactlyOnceWith('mpcoreArtifact', updated)
    expect(host.vitest.rerunTestSpecifications).not.toHaveBeenCalled()
    await host.close()
  })

  it('surfaces runner failures and continues processing later artifact updates', async () => {
    const host = runner(true)
    const error = new Error('failed to schedule tests')
    host.vitest.globTestSpecifications.mockRejectedValueOnce(error)
    let rebuild!: (artifact: MiniProgramArtifact) => Promise<void>
    const plugin = mpcoreTest({ artifact: { build: async () => artifact, watch: async ({ onRebuilt }) => {
      rebuild = onRebuilt
      return { artifact, close: vi.fn() }
    } } })
    await plugin.configureVitest(host.context)
    await rebuild(artifact)
    expect(host.vitest.state.catchError).toHaveBeenCalledWith(error, 'Mpcore Artifact Error')
    await rebuild(artifact)
    expect(host.vitest.rerunTestSpecifications).toHaveBeenCalledTimes(1)
    await host.close()
  })
})
