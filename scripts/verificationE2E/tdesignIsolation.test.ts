import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { attachRuntimeErrorCollector } from '../../e2e/ide/runtimeErrors'
import { relaunchTemplateWevuTdesignRegressionPage } from '../../e2e/ide/template-wevu-tdesign-regression.shared'
import { withFixtureCaseScope } from '../../e2e/utils/fixtureCaseScope'
import { createFixtureSessionOwner } from '../../e2e/utils/fixtureSession'

describe('shared TDesign case isolation', () => {
  it('recreates page state for each case while keeping one fixture build and host session', async () => {
    const host = {
      reLaunch: vi.fn(async (route: string) => ({ path: route.slice(1), data: { urgent: false, logs: [] as string[] } })),
    }
    const build = vi.fn(async () => {})
    const launch = vi.fn(async () => host)
    const owner = createFixtureSessionOwner({ build, launch, close: async () => {} })
    const first = await relaunchTemplateWevuTdesignRegressionPage({}, await owner.get(), '/pages/form/index', 'form')
    first.data.urgent = true
    first.data.logs.push('previous case')
    const second = await relaunchTemplateWevuTdesignRegressionPage({}, await owner.get(), '/pages/form/index', 'form')
    expect(second.data).toEqual({ urgent: false, logs: [] })
    expect(second).not.toBe(first)
    expect(host.reLaunch).toHaveBeenCalledTimes(2)
    expect(build).toHaveBeenCalledOnce()
    expect(launch).toHaveBeenCalledOnce()
    await owner.close(true)
  })

  it('drains buffered events at case boundaries and preserves unrelated host listeners', async () => {
    const host = new EventEmitter()
    const unrelated = vi.fn()
    host.on('console', unrelated)
    let buffered = 'previous case'
    const flush = async () => {
      if (buffered) {
        host.emit('console', { level: 'error', text: buffered })
        buffered = ''
      }
    }
    const collector = await withFixtureCaseScope({
      flush,
      attach: () => attachRuntimeErrorCollector(host),
      run: async (collector) => {
        expect(collector.getAll()).toEqual([])
        buffered = 'current case'
        return collector
      },
    })
    expect(collector.getAll()).toEqual(['[console:error] current case'])
    expect(host.listenerCount('console')).toBe(1)
    expect(host.listenerCount('exception')).toBe(0)
    host.emit('console', { level: 'error', text: 'later case' })
    expect(collector.getAll()).toEqual(['[console:error] current case'])
    expect(unrelated).toHaveBeenCalledTimes(3)
  })

  it('always removes case listeners and preserves the case failure when final flushing also fails', async () => {
    const host = new EventEmitter()
    const original = new Error('case failed')
    const flush = vi.fn(async () => {}).mockResolvedValueOnce().mockRejectedValue(new Error('flush failed'))
    await expect(withFixtureCaseScope({
      flush,
      attach: () => attachRuntimeErrorCollector(host),
      run: async () => { throw original },
    })).rejects.toBe(original)
    expect(host.listenerCount('console')).toBe(0)
    expect(host.listenerCount('exception')).toBe(0)
  })

  it('verifies late console errors after the final flush and still removes its listeners', async () => {
    const host = new EventEmitter()
    let buffered = false
    const order: string[] = []
    await expect(withFixtureCaseScope({
      flush: async () => {
        order.push('flush')
        if (buffered) {
          host.emit('console', { level: 'error', text: 'late case error' })
        }
      },
      attach: () => attachRuntimeErrorCollector(host),
      run: async (collector) => {
        expect(collector.getAll()).toEqual([])
        order.push('run')
        buffered = true
      },
      verify: (collector) => {
        order.push('verify')
        if (collector.getAll().length) {
          throw new Error(collector.getAll().join('\n'))
        }
      },
    })).rejects.toThrow('late case error')
    expect(order).toEqual(['flush', 'run', 'flush', 'verify'])
    expect(host.listenerCount('console')).toBe(0)
    expect(host.listenerCount('exception')).toBe(0)
  })

  it('fails a successful case when final console flushing fails', async () => {
    const dispose = vi.fn()
    const failure = new Error('flush failed')
    const flush = vi.fn(async () => {}).mockResolvedValueOnce().mockRejectedValue(failure)
    await expect(withFixtureCaseScope({ flush, attach: () => ({ dispose }), run: async () => 1 })).rejects.toBe(failure)
    expect(dispose).toHaveBeenCalledOnce()
  })
})
