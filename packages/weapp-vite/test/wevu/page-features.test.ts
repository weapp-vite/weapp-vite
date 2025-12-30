import { describe, expect, it } from 'vitest'
import { injectWevuPageFeaturesInJs } from '../../src/plugins/wevu/pageFeatures'

describe('wevu page features', () => {
  it('injects features into top-level defineComponent options', () => {
    const source = `import { defineComponent, onShareAppMessage } from 'wevu'

defineComponent({
  setup() {
    onShareAppMessage(() => ({}))
  },
})`

    const result = injectWevuPageFeaturesInJs(source)

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('features')
    expect(result.code).toContain('enableOnShareAppMessage')
  })

  it('supports aliased hook imports', () => {
    const source = `import { defineComponent, onReachBottom as onBottom } from 'wevu'

defineComponent({
  setup() {
    onBottom(() => {})
  },
})`

    const result = injectWevuPageFeaturesInJs(source)

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('enableOnReachBottom')
  })

  it('does not touch non-wevu pages', () => {
    const source = `Page({
  onLoad() {},
})`

    const result = injectWevuPageFeaturesInJs(source)

    expect(result.transformed).toBe(false)
    expect(result.code).toBe(source)
  })

  it('does not override explicit feature flags', () => {
    const source = `import { defineComponent, onShareAppMessage } from 'wevu'

defineComponent({
  features: { enableOnShareAppMessage: false },
  setup() {
    onShareAppMessage(() => ({}))
  },
})`

    const result = injectWevuPageFeaturesInJs(source)

    expect(result.transformed).toBe(false)
    expect(result.code).toBe(source)
  })
})
