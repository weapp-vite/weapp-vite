import { describe, expect, it } from 'vitest'
import { analyzeCaseSource } from './inventoryAnalyzer'

const file = 'e2e/ide/conditional-matrix.test.ts'

describe('static suite row conditions', () => {
  it('resolves immutable comparison aliases separately for each mode', () => {
    const cases = analyzeCaseSource(`
      describe.each(['classic', 'stateful-experimental'])('%s', runtime => {
        const requested = runtime
        const stateful = requested === 'stateful-experimental'
        const enabled = stateful
        it('shared', ctx => createDomAcceptance(ctx, 'fixture', []))
        if (enabled) {
          it('stateful-only', ctx => createDomAcceptance(ctx, 'fixture', []))
        } else {
          it('classic-only', ctx => createDomAcceptance(ctx, 'fixture', []))
        }
      })
    `, file)
    expect(cases.map(item => item.name)).toEqual([
      'classic > shared',
      'classic > classic-only',
      'stateful-experimental > shared',
      'stateful-experimental > stateful-only',
    ])
    expect(cases.every(item => item.plans.length === 1 && item.notes.length === 0)).toBe(true)
  })

  it.each(['===', '!=='])('resolves direct %s comparisons without guessing truthiness', (operator) => {
    const cases = analyzeCaseSource(`
      describe.each(['classic', 'stateful-experimental'])('%s', runtime => {
        if ((runtime ${operator} 'stateful-experimental')) {
          it('matches', ctx => createDomAcceptance(ctx, 'fixture', []))
        } else {
          it('differs', ctx => createDomAcceptance(ctx, 'fixture', []))
        }
      })
    `, file)
    expect(cases.map(item => item.name)).toEqual(operator === '==='
      ? ['classic > differs', 'stateful-experimental > matches']
      : ['classic > matches', 'stateful-experimental > differs'])
  })

  it('does not mistake object property names or shorthand references for shadowed bindings', () => {
    const cases = analyzeCaseSource(`
      describe.each(['classic', 'stateful-experimental'])('%s', runtime => {
        const stateful = runtime === 'stateful-experimental'
        const diagnostic = { runtime, stateful: runtime, settings: { stateful } }
        if (stateful) {
          it('stateful-only', ctx => createDomAcceptance(ctx, 'fixture', []))
        } else {
          it('classic-only', ctx => createDomAcceptance(ctx, 'fixture', []))
        }
      })
    `, file)
    expect(cases.map(item => item.name)).toEqual([
      'classic > classic-only',
      'stateful-experimental > stateful-only',
    ])
  })

  it('preserves both branches for unknown values, loose comparisons, and scalar truthiness', () => {
    const cases = analyzeCaseSource(`
      describe.each(['classic'])('%s', runtime => {
        const unknown = runtimeFlag()
        const truthy = runtime
        if (unknown === runtime) {
          it('unknown-then', () => {})
        } else {
          it('unknown-else', () => {})
        }
        if (runtime == 'classic') {
          it('loose-then', () => {})
        } else {
          it('loose-else', () => {})
        }
        if (truthy) {
          it('truthy-then', () => {})
        } else {
          it('truthy-else', () => {})
        }
      })
    `, file)
    expect(cases.map(item => item.name)).toEqual([
      'classic > unknown-then',
      'classic > unknown-else',
      'classic > loose-then',
      'classic > loose-else',
      'classic > truthy-then',
      'classic > truthy-else',
    ])
  })

  it('does not certify aliases of mutated or function-shadowed parameters', () => {
    const cases = analyzeCaseSource(`
      describe.each(['classic'])('mutated %s', runtime => {
        runtime = 'stateful-experimental'
        const stateful = runtime === 'stateful-experimental'
        if (stateful) {
          it('possible', () => {})
        } else {
          it('also-possible', () => {})
        }
      })
      describe.each(['classic'])('shadowed %s', mode => {
        describe('inner', () => {
          const mode = runtimeFlag()
          const enabled = mode === 'stateful-experimental'
          if (enabled) {
            it('possible', () => {})
          } else {
            it('also-possible', () => {})
          }
        })
      })
    `, file)
    expect(cases.map(item => item.name)).toEqual([
      'mutated classic > possible',
      'mutated classic > also-possible',
      'shadowed classic > inner > possible',
      'shadowed classic > inner > also-possible',
    ])
  })

  it('preserves mutable aliases and aliases shadowed in another callback scope', () => {
    const cases = analyzeCaseSource(`
      describe.each(['classic'])('%s', runtime => {
        let mutable = runtime === 'stateful-experimental'
        mutable = runtimeFlag()
        if (mutable) {
          it('mutable-then', () => {})
        } else {
          it('mutable-else', () => {})
        }
        const enabled = runtime === 'stateful-experimental'
        describe('inner', () => {
          const enabled = runtimeFlag()
          if (enabled) {
            it('shadow-then', () => {})
          } else {
            it('shadow-else', () => {})
          }
        })
      })
    `, file)
    expect(cases.map(item => item.name)).toEqual([
      'classic > mutable-then',
      'classic > mutable-else',
      'classic > inner > shadow-then',
      'classic > inner > shadow-else',
    ])
  })
})
