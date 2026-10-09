import type { ChunkGraphLinkGeometry } from './chunkGraphGeometry'
import { describe, expect, it } from 'vitest'
import { updateChunkGraphLinkGeometry } from './chunkGraphGeometry'

function createLink(): ChunkGraphLinkGeometry {
  return { x1: 0, y1: 0, x2: 0, y2: 0, visible: false }
}

const source = { x: 0, y: 0, radius: 10, strokeWidth: 2 }
const target = { x: 100, y: 0, radius: 20, strokeWidth: 4 }

describe('chunk graph circle boundaries', () => {
  it('places both endpoints outside unequal node radii and strokes', () => {
    const link = createLink()
    updateChunkGraphLinkGeometry(link, source, target, true)
    expect(link).toEqual({ x1: 13, y1: 0, x2: 76, y2: 0, visible: true })
  })

  it('preserves source-to-target direction when the edge points left', () => {
    const link = createLink()
    updateChunkGraphLinkGeometry(link, target, source, true)
    expect(link).toEqual({ x1: 76, y1: 0, x2: 13, y2: 0, visible: true })
  })

  it.each([
    [60, 80],
    [-60, 80],
    [60, -80],
    [-60, -80],
    [0, 100],
    [0, -100],
  ])('clips along the center vector toward (%s, %s)', (x, y) => {
    const link = createLink()
    const end = { ...target, x, y }
    updateChunkGraphLinkGeometry(link, source, end, true)
    expect(link.visible).toBe(true)
    expect(Math.hypot(link.x1, link.y1)).toBeCloseTo(13)
    expect(Math.hypot(x - link.x2, y - link.y2)).toBeCloseTo(24)
    expect(link.x1 * y - link.y1 * x).toBeCloseTo(0)
    expect(link.x2 * y - link.y2 * x).toBeCloseTo(0)
    expect((link.x2 - link.x1) * x + (link.y2 - link.y1) * y).toBeGreaterThan(0)
  })

  it('keeps geometry correct when both nodes are translated', () => {
    const link = createLink()
    updateChunkGraphLinkGeometry(link, { ...source, x: -150, y: 40 }, { ...target, x: -50, y: 40 }, true)
    expect(link).toEqual({ x1: -137, y1: 40, x2: -74, y2: 40, visible: true })
  })

  it.each([0, 20, 37])('hides coincident, overlapping or touching boundaries at distance %s', (x) => {
    for (const directed of [false, true]) {
      const link = createLink()
      updateChunkGraphLinkGeometry(link, source, { ...target, x }, directed)
      expect(link.visible).toBe(false)
      expect([link.x1, link.y1, link.x2, link.y2].every(Number.isFinite)).toBe(true)
    }
  })

  it('requires enough external space for the entire arrow, but not for containment', () => {
    const link = createLink()
    updateChunkGraphLinkGeometry(link, source, { ...target, x: 40 }, false)
    expect(link).toEqual({ x1: 13, y1: 0, x2: 16, y2: 0, visible: true })
    updateChunkGraphLinkGeometry(link, source, { ...target, x: 40 }, true)
    expect(link.visible).toBe(false)
    updateChunkGraphLinkGeometry(link, source, { ...target, x: 45 }, true)
    expect(link.visible).toBe(true)
    expect(link.x2 - link.x1).toBe(8)
  })

  it('hides a previously visible edge during overlap and restores it after dragging apart', () => {
    const link = createLink()
    updateChunkGraphLinkGeometry(link, source, target, true)
    expect(link.visible).toBe(true)
    updateChunkGraphLinkGeometry(link, source, source, true)
    expect(link.visible).toBe(false)
    updateChunkGraphLinkGeometry(link, { ...source, x: 200 }, target, true)
    expect(link).toEqual({ x1: 187, y1: 0, x2: 124, y2: 0, visible: true })
  })
})
