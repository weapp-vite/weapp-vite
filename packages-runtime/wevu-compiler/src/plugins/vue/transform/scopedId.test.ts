import { describe, expect, it } from 'vitest'
import { generateScopedId } from './scopedId'

describe('generateScopedId', () => {
  it('is deterministic for the same filename', () => {
    const filename = '/project/src/pages/index/index.vue'
    expect(generateScopedId(filename)).toBe(generateScopedId(filename))
  })

  it('returns different values for different filenames', () => {
    const a = generateScopedId('/project/src/pages/a/index.vue')
    const b = generateScopedId('/project/src/pages/b/index.vue')

    expect(a).not.toBe(b)
  })

  it('does not depend on the local workspace root', () => {
    expect(generateScopedId('/Users/example/project/src/pages/home/index.vue'))
      .toBe(generateScopedId('/builds/ci/project/src/pages/home/index.vue'))
  })
})
