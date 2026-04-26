import type { InternalRuntimeState } from './types'
import { afterEach, describe, expect, it } from 'vitest'
import {
  isRuntimeLayoutComponentTarget,
  setRuntimeLayoutComponentMatcher,
} from './layoutComponentMatcher'

describe('runtime layout component matcher', () => {
  afterEach(() => {
    setRuntimeLayoutComponentMatcher(undefined)
  })

  it('uses the default layout component path matcher', () => {
    expect(isRuntimeLayoutComponentTarget({ is: 'layouts/default' } as InternalRuntimeState)).toBe(true)
    expect(isRuntimeLayoutComponentTarget({ is: 'components/default' } as InternalRuntimeState)).toBe(false)
  })

  it('allows the layout matcher to be replaced by runtime integration', () => {
    setRuntimeLayoutComponentMatcher(componentPath => componentPath.startsWith('shells/'))

    expect(isRuntimeLayoutComponentTarget({ is: 'layouts/default' } as InternalRuntimeState)).toBe(false)
    expect(isRuntimeLayoutComponentTarget({ is: 'shells/default' } as InternalRuntimeState)).toBe(true)
  })
})
