import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { createFiniteUniLauncher } from './uniLifecycle'

interface FakeWatcher {
  closed: boolean
  closeCalls: number
  close: () => Promise<void>
}

function launch(buildFailure?: Error, cleanupFailure?: Error) {
  const instances: FakeWatcher[] = []
  class FileWatcher implements FakeWatcher {
    closed = false
    closeCalls = 0
    watch() {
      instances.push(this)
      return this
    }

    async close() {
      this.closeCalls++
      this.closed = true
      if (cleanupFailure) {
        throw cleanupFailure
      }
    }
  }
  const originalWatch = FileWatcher.prototype.watch
  const unrelated = new FileWatcher().watch()
  const state = { env: {} as Record<string, string>, argv: ['node', 'compile.cjs', 'development', 'mp-xhs', 'out/development'], exitCode: 0 }
  const modes: string[] = []
  const logs: unknown[] = []
  const exported = { exports: undefined as unknown }
  const modules: Record<string, unknown> = {
    'node:process': state,
    '@dcloudio/uni-cli-shared/dist/alias': {},
    '@dcloudio/uni-cli-shared/dist/polyfill': {},
    '@dcloudio/uni-cli-shared/dist/watcher': { FileWatcher },
    '@dcloudio/vite-plugin-uni/dist/cli/utils': {
      initEnv(type: string) {
        modes.push(type)
        expect(state.env.NODE_ENV).toBe('development')
      },
    },
    '@dcloudio/vite-plugin-uni/dist/cli/build': {
      async build() {
        modes.push(state.env.NODE_ENV!)
        const owned = new FileWatcher()
        owned.watch()
        owned.watch()
        new FileWatcher().watch()
        if (buildFailure) {
          throw buildFailure
        }
      },
    },
  }
  vm.runInNewContext(createFiniteUniLauncher(), {
    require(id: string) {
      if (!(id in modules)) {
        throw new Error(`Unexpected dependency ${id}`)
      }
      return modules[id]
    },
    module: exported,
    console: { log: (message: unknown) => logs.push(message), error: (error: unknown) => logs.push(error) },
  })
  return { completion: exported.exports as Promise<void>, state, modes, instances, unrelated, logs, FileWatcher, originalWatch }
}

describe('finite official uni development compilation', () => {
  it('awaits compilation, closes only owned watcher instances once and restores the prototype', async () => {
    const run = launch()
    await run.completion
    expect(run.modes).toEqual(['dev', 'development'])
    expect(run.state.env.NODE_ENV).toBe('development')
    expect(run.unrelated.closed).toBe(false)
    expect(run.instances.filter(instance => instance !== run.unrelated).every(instance => instance.closed)).toBe(true)
    expect(run.instances.filter(instance => instance !== run.unrelated).every(instance => instance.closeCalls === 1)).toBe(true)
    expect(run.FileWatcher.prototype.watch).toBe(run.originalWatch)
    expect(run.logs).toContain('template-corpus:finite-build {"mode":"development","ownedWatchersClosed":2}')
    expect(run.state.exitCode).toBe(0)
  })

  it('retains the original build failure and still closes owned resources', async () => {
    const failure = new Error('compiler rejected fixture')
    const run = launch(failure)
    await expect(run.completion).rejects.toMatchObject({ errors: [failure] })
    expect(run.instances.filter(instance => instance !== run.unrelated).every(instance => instance.closed)).toBe(true)
    expect(run.FileWatcher.prototype.watch).toBe(run.originalWatch)
    expect(run.state.exitCode).toBe(1)
  })

  it('preserves compiler and cleanup failures together and refuses a success receipt', async () => {
    const buildFailure = new Error('compiler failed')
    const cleanupFailure = new Error('watcher close failed')
    const run = launch(buildFailure, cleanupFailure)
    await expect(run.completion).rejects.toMatchObject({ errors: [buildFailure, cleanupFailure, cleanupFailure] })
    expect(run.unrelated.closed).toBe(false)
    expect(run.FileWatcher.prototype.watch).toBe(run.originalWatch)
    expect(run.state.exitCode).toBe(1)
    expect(run.logs.some(log => typeof log === 'string' && log.includes('finite-build'))).toBe(false)
  })
})
