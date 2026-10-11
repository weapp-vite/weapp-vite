import { describe, expect, it, vi } from 'vitest'
import { capturePreparationInputs } from './entryPreparationInputs'

describe('declarative entry preparation inputs', () => {
  it('checks nested configuration and plugin list identity without reading plugin state', () => {
    const getter = vi.fn(() => new Map())
    const plugin = Object.defineProperty({ name: 'opaque-plugin' }, 'state', { get: getter })
    const config = {
      config: { plugins: [[plugin]], customLogger: new Map(), build: { rolldownOptions: { output: [{ plugins: [plugin] }] } } },
      loadOptions: { hostConfig: { config: { plugins: [plugin] } } },
    }
    const weapp = { subPackages: { isolated: { inlineConfig: { plugins: [plugin], define: { LABEL: 'initial' } } } } }
    const unchanged = capturePreparationInputs(config, weapp)
    expect(unchanged?.()).toBe(true)
    expect(getter).not.toHaveBeenCalled()
    weapp.subPackages.isolated.inlineConfig.define.LABEL = 'changed'
    expect(unchanged?.()).toBe(false)
  })

  it.each(['replace', 'reorder', 'append'] as const)('rejects a plugin list %s', (change) => {
    const plugins = [{ name: 'first' }, { name: 'second' }]
    const unchanged = capturePreparationInputs({ config: { plugins } }, {})
    expect(unchanged?.()).toBe(true)
    if (change === 'replace') {
      plugins[0] = { name: 'first' }
    }
    else if (change === 'reorder') {
      plugins.reverse()
    }
    else {
      plugins.push({ name: 'third' })
    }
    expect(unchanged?.()).toBe(false)
  })

  it('treats plugins outside known plugin locations as ordinary mutable data', () => {
    const config = { config: { define: { plugins: [{ label: 'before' }] } } }
    const unchanged = capturePreparationInputs(config, {})
    config.config.define.plugins[0]!.label = 'after'
    expect(unchanged?.()).toBe(false)
  })

  it('falls back for accessor or opaque declarative values without invoking getters', () => {
    const getter = vi.fn(() => 'source')
    expect(capturePreparationInputs({ config: Object.defineProperty({}, 'root', { get: getter }) }, {})).toBeUndefined()
    expect(getter).not.toHaveBeenCalled()
    expect(capturePreparationInputs({ config: { define: new Map() } }, {})).toBeUndefined()
  })

  it('handles cycles, regular expressions and primitive mutations within the field budget', () => {
    const config: { match: RegExp, self?: unknown, keys: string[] } = { match: /pages/g, keys: ['first'] }
    config.self = config
    const unchanged = capturePreparationInputs(config, {})
    expect(unchanged?.()).toBe(true)
    config.match.lastIndex = 3
    expect(unchanged?.()).toBe(true)
    config.keys.push('second')
    expect(unchanged?.()).toBe(false)
    expect(capturePreparationInputs({ data: Array.from({ length: 20_001 }).fill(0) }, {})).toBeUndefined()
  })
})
