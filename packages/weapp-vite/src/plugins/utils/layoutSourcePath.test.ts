import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT_SOURCE_ROOT, isLayoutSourcePath } from './layoutSourcePath'

describe('layout source path utilities', () => {
  it('matches the default layout source root', () => {
    expect(DEFAULT_LAYOUT_SOURCE_ROOT).toBe('layouts')
    expect(isLayoutSourcePath('layouts')).toBe(true)
    expect(isLayoutSourcePath('layouts/default/index.ts')).toBe(true)
    expect(isLayoutSourcePath('/layouts/default/index.ts')).toBe(true)
    expect(isLayoutSourcePath('layouts-default/index.ts')).toBe(false)
    expect(isLayoutSourcePath('pages/layouts/index.ts')).toBe(false)
  })

  it('supports a custom layout source root', () => {
    expect(isLayoutSourcePath('shells', 'shells')).toBe(true)
    expect(isLayoutSourcePath('shells/default/index.ts', 'shells/')).toBe(true)
    expect(isLayoutSourcePath('layouts/default/index.ts', 'shells')).toBe(false)
  })
})
