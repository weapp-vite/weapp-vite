import { describe, expect, it } from 'vitest'
import {
  assertStatefulHmrRuntimeOutput,
  createStatefulHmrRolldownRuntimeSource,
  StatefulHmrRuntimeCompatibilityError,
} from './commonRuntime'

describe('stateful HMR common runtime', () => {
  it('owns one complete Rolldown dev runtime without external imports', () => {
    const source = createStatefulHmrRolldownRuntimeSource()

    expect(source.match(/class DevRuntime/g)).toHaveLength(1)
    expect(source.match(/class WeappViteDevRuntime/g)).toHaveLength(1)
    expect(source).toContain('new WeappViteDevRuntime')
    expect(source).toContain('__WEAPP_VITE_STATEFUL_HMR_BRIDGE__')
    expect(source).not.toContain('experimental-runtime-base.mjs')
    expect(source).not.toMatch(/^\s*(?:import|export)\s/m)
  })

  it('rejects initial outputs that omit the common runtime', () => {
    expect(() => assertStatefulHmrRuntimeOutput([
      { code: 'var BaseDevRuntime = DevRuntime;', fileName: 'rolldown-runtime.js', type: 'chunk' },
      { code: 'App({});', fileName: 'app.js', type: 'chunk' },
    ])).toThrow(StatefulHmrRuntimeCompatibilityError)
  })

  it('accepts a complete generated runtime output', () => {
    expect(() => assertStatefulHmrRuntimeOutput([
      {
        code: createStatefulHmrRolldownRuntimeSource(),
        fileName: 'rolldown-runtime.js',
        type: 'chunk',
      },
    ])).not.toThrow()
  })
})
