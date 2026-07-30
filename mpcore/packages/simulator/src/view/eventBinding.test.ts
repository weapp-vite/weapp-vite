import { describe, expect, it } from 'vitest'
import { collectMiniProgramEventBindings } from './eventBinding'

describe('mini-program event binding resolution', () => {
  it('prefers legacy bindings regardless of attribute order', () => {
    expect(collectMiniProgramEventBindings({
      'bind:probe': 'colon',
      'bindprobe': 'legacy',
    }).get('probe')).toEqual({
      method: 'legacy',
      stopAfter: false,
    })
    expect(collectMiniProgramEventBindings({
      'bindprobe': 'legacy',
      'bind:probe': 'colon',
    }).get('probe')).toEqual({
      method: 'legacy',
      stopAfter: false,
    })
  })

  it('requires colon syntax for hyphenated names and keeps underscores compatible', () => {
    const bindings = collectMiniProgramEventBindings({
      'bind:probe-hyphen': 'hyphen-colon',
      'bind:probe_under': 'underscore-colon',
      'bindprobe-hyphen': 'hyphen-legacy',
      'bindprobe_under': 'underscore-legacy',
    })

    expect(bindings.get('probe-hyphen')).toEqual({
      method: 'hyphen-colon',
      stopAfter: false,
    })
    expect(bindings.get('probe_under')).toEqual({
      method: 'underscore-legacy',
      stopAfter: false,
    })
  })
})
