import { WEVU_SETUP_READY_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { prepareComponentOptions } from '../src/runtime/register/component/options'

describe('compiled setup barrier and native pure data', () => {
  it.each([/^_/, /wevu|private/, /_/, /^_/g, /^(?:_|cache)/, /./])('exempts the internal signal while preserving business matches for %s', (pattern) => {
    pattern.lastIndex = 2
    const prepared = prepareComponentOptions({
      [WEVU_SETUP_READY_KEY]: false,
      options: { pureDataPattern: pattern, virtualHost: true },
    } as any)
    const next = prepared.userOptions.pureDataPattern as RegExp
    expect(new RegExp(next.source, next.flags).test(WEVU_SETUP_READY_KEY)).toBe(false)
    for (const key of ['_private', 'user_private', 'label', 'cache', 'aa', 'mywevuField', '__WEVUSETUPREADY', '_0', '__00']) {
      expect(new RegExp(next.source, next.flags).test(key)).toBe(new RegExp(pattern.source, pattern.flags).test(key))
    }
    expect(pattern.lastIndex).toBe(2)
    expect(prepared.userOptions.virtualHost).toBe(true)
  })

  it('preserves uncompiled component options and nonconflicting patterns by identity', () => {
    const options = { pureDataPattern: /^cache/ }
    expect(prepareComponentOptions({ [WEVU_SETUP_READY_KEY]: false, options } as any).userOptions).toBe(options)
    const matching = { pureDataPattern: /^_/ }
    expect(prepareComponentOptions({ options: matching }).userOptions).toBe(matching)
  })
})
