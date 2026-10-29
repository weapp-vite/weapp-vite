import { describe, expect, it, vi } from 'vitest'
import { getDevModuleGraphSourceObservation, retireDevModuleGraphSourceObservation } from './sourceObservation'

const change = { event: 'update', file: 'src/page.ts' } as const

describe('Vite plugin source observation capsule', () => {
  it('keeps an already captured observation available after graph retirement', () => {
    const ctx = {}
    const observation = getDevModuleGraphSourceObservation(ctx)
    const observe = vi.fn(value => value)
    observation.bind(observe)
    retireDevModuleGraphSourceObservation(ctx, observation)
    expect(observation.observe(change)).toBe(change)
    expect(observe).toHaveBeenCalledOnce()
  })

  it('prevents retirement of an old capsule from clearing a replacement on the same context', () => {
    const ctx = {}
    const previous = getDevModuleGraphSourceObservation(ctx)
    previous.bind(vi.fn(value => value))
    retireDevModuleGraphSourceObservation(ctx, previous)
    const replacement = getDevModuleGraphSourceObservation(ctx)
    const observe = vi.fn(value => value)
    replacement.bind(observe)
    retireDevModuleGraphSourceObservation(ctx, previous)
    expect(getDevModuleGraphSourceObservation(ctx)).toBe(replacement)
    replacement.observe(change)
    expect(observe).toHaveBeenCalledOnce()
    retireDevModuleGraphSourceObservation(ctx, replacement)
  })
})
