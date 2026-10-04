import { describe, expect, it } from 'vitest'
import { normalizeComponentPageDefinition } from './globals'

describe('normalizeComponentPageDefinition', () => {
  it('dispatches page lifetimes and legacy page methods in host order', () => {
    const calls: string[] = []
    const page = { calls }
    const definition = normalizeComponentPageDefinition({
      lifetimes: {
        ready(this: typeof page) {
          this.calls.push('lifetime-ready')
        },
      },
      pageLifetimes: {
        show(this: typeof page) {
          this.calls.push('page-show')
        },
        hide(this: typeof page) {
          this.calls.push('page-hide')
        },
      },
      methods: {
        onShow(this: typeof page) {
          this.calls.push('method-show')
        },
        onHide(this: typeof page) {
          this.calls.push('method-hide')
        },
        onReady(this: typeof page) {
          this.calls.push('method-ready')
        },
      },
    })

    definition.onShow.call(page)
    definition.onReady.call(page)
    definition.onHide.call(page)

    expect(calls).toEqual([
      'page-show',
      'method-show',
      'lifetime-ready',
      'method-ready',
      'page-hide',
      'method-hide',
    ])
  })

  it('does not invoke the same callback twice when aliases share a function', () => {
    const calls: string[] = []
    const callback = function (this: { calls: string[] }) {
      this.calls.push('callback')
    }
    const definition = normalizeComponentPageDefinition({
      pageLifetimes: { show: callback },
      methods: { onShow: callback },
    })

    definition.onShow.call({ calls })

    expect(calls).toEqual(['callback'])
  })
})
