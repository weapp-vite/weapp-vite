import { describe, expect, it } from 'vitest'
import { filmSpecs } from '../src/timeline'
import { validateTimeline } from './validateTimeline'

describe('promo timeline delivery contract', () => {
  it('accepts the complete landscape and portrait edit', () => {
    expect(() => validateTimeline()).not.toThrow()
  })

  it.each([-1, 1])('rejects a %i-frame overlap or gap between shots', (offset) => {
    const specs = structuredClone(filmSpecs)
    specs[0].shots[1]!.startFrame += offset
    specs[0].shots[1]!.endFrame += offset
    expect(() => validateTimeline(specs)).toThrow('non-contiguous shot boundary')
  })

  it('rejects a cue at the exclusive end of a shot', () => {
    const specs = structuredClone(filmSpecs)
    specs[0].shots[0]!.cues = [0, 100, 300]
    expect(() => validateTimeline(specs)).toThrow('cue must be inside the shot')
  })

  it('rejects preview cuts that drift from the edit', () => {
    const specs = structuredClone(filmSpecs)
    specs[1].cuts[1] = 4
    expect(() => validateTimeline(specs)).toThrow('cuts must be derived from shot boundaries')
  })

  it('rejects a missing shot and an incorrect total duration', () => {
    const missing = structuredClone(filmSpecs)
    missing[0].shots.pop()
    expect(() => validateTimeline(missing)).toThrow('expected 12 shots')
    const duration = structuredClone(filmSpecs)
    duration[1].frames = 1801
    expect(() => validateTimeline(duration)).toThrow('incorrect total duration')
  })

  it('rejects an incorrect closing shot', () => {
    const specs = structuredClone(filmSpecs)
    specs[1].shots.at(-1)!.kind = 'intro'
    expect(() => validateTimeline(specs)).toThrow('first/last shots must be intro/outro')
  })
})
