import type { Options } from './host'
import { WEVU_INLINE_MAP_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { createSemanticTools } from '../async'
import { createDeferredCalls, createScenarioHost, strictObject } from './host'
import { createSemanticScenario, semanticCoverage } from './index'

describe('finite semantic scenario host', () => {
  it('rejects unknown host methods including inherited object methods', () => {
    const host = strictObject('wpi', { navigateTo: () => 'known' }) as Record<string, unknown>
    expect((host.navigateTo as () => string)()).toBe('known')
    expect(() => host.uploadFile).toThrow('Unsupported wpi.uploadFile')
    expect(() => host.constructor).toThrow('Unsupported wpi.constructor')
  })

  it('preserves ordinary logged message objects and error causes', () => {
    const { tools } = createSemanticTools()
    const host = createScenarioHost(tools, [])
    const ordinary = { message: 'business payload', other: { retained: true } }
    const error = new Error('failure', { cause: new Error('root cause') })
    host.globals.console.error!(ordinary, error)
    expect(host.logs[0]!.arguments).toEqual([ordinary, error])
    expect(host.logs[0]!.arguments[0]).toBe(ordinary)
    host.dispose()
  })

  it('tracks controlled services, rejects unknown or duplicate calls, and refuses unsettled completion', async () => {
    const { tools, state } = createSemanticTools()
    const host = createScenarioHost(tools, [])
    const queue = createDeferredCalls(host, tools, ['load'])
    expect(() => queue.invoke('unknown', [])).toThrow('Unknown deferred method')
    const result = queue.invoke('load', ['item'])
    expect(() => queue.invoke('load', [])).toThrow('Unsettled duplicate')
    expect(() => queue.assertEmpty()).toThrow('Unsettled services')
    expect(state[0]!.status).toBe('pending')
    await queue.resolve('load', { title: 'loaded' })
    await expect(result).resolves.toEqual({ title: 'loaded' })
    await tools.flush()
    expect(state[0]!.status).toBe('fulfilled')
    queue.assertEmpty()
    host.dispose()
  })

  it('records actual handler execution and rejects missing handlers before dispatcher fallback', () => {
    const { tools } = createSemanticTools()
    const host = createScenarioHost(tools, [])
    const options: Options = {
      __wevu_isPage: true,
      __wevuBindingManifest: Object.freeze({}),
      data: () => ({ nested: {} }),
      setup: (_, { expose }) => {
        expose()
        return { count: 0 }
      },
      computed: {},
      methods: { [WEVU_INLINE_MAP_KEY]: { i0: { keys: [], fn: (ctx) => { ctx.count++ } } } },
    }
    host.imports['virtual:weapp-vite/runtime'].installInlineEvents()
    host.imports['virtual:weapp-vite/runtime'].createWevuComponent(options)
    const initialized = host.initialize({ default: options }, ['i0'], [])
    expect(() => host.dispatch(initialized.options, initialized.ctx, 'missing')).toThrow('Unknown inline handler')
    host.dispatch(initialized.options, initialized.ctx, 'i0')
    expect(initialized.ctx.count).toBe(1)
    expect(host.inlineInvocations).toEqual([{ id: 'i0', executions: 1 }])
    host.dispose()
  })

  it('exports immutable coverage copies and rejects unknown scenario ids', () => {
    const coverage = semanticCoverage('sfc-wevu')
    coverage.inlineIds.length = 0
    expect(semanticCoverage('sfc-wevu').inlineIds).toHaveLength(7)
    expect(semanticCoverage('sfc-retail').inlineIds).toHaveLength(14)
    expect(() => semanticCoverage('unknown')).toThrow('Unsupported semantic scenario')
    expect(() => createSemanticScenario('unknown', createSemanticTools().tools)).toThrow('Unsupported semantic scenario')
  })
})
