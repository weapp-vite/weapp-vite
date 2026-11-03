import type { Fixture } from './types'
import { describe, expect, it } from 'vitest'
import { cohorts } from './cohorts'
import { features, supplementFixtures } from './fixtures'
import { readPolicy } from './freeze'

describe('fixed WXML feature and pressure inputs', () => {
  it('classifies overlapping source features without timing or parser success', async () => {
    const policy = await readPolicy()
    const dense = `<div ${Array.from({ length: 8 }, (_, i) => `data-k${i}="${i}"`).join(' ')}>{{value}} &amp;</div>`
    expect(features(dense, policy.features)).toEqual(['attributes-dense', 'interpolation', 'entities', 'web'])
    expect(features('<wxs module="m">module.exports={}</wxs>', policy.features)).toEqual(['script'])
  })

  it('keeps pressure sources separate from the unchanged real aggregate', async () => {
    const policy = await readPolicy()
    const original: Fixture = { id: 'real', sha256: 'hash', source: '<view/>', bytes: 7, origins: ['page.wxml'], platform: 'weapp', cohort: 'shared', size: 'small' }
    const first = supplementFixtures([original], policy)
    const second = supplementFixtures([original], policy)
    expect(first).toEqual(second)
    expect(first.filter(file => file.synthetic)).toHaveLength(10)
    expect(first.find(file => file.pressureId === 'stress-deep-tree-2048')!.source.match(/<view>/g)).toHaveLength(2048)
    expect(first.find(file => file.pressureId === 'stress-long-text-1048576')!.source).toHaveLength(1048589)
    const groups = cohorts(first)
    expect(groups.find(([id]) => id === 'shared')![1].map(file => file.id)).toEqual(['real'])
    expect(groups.at(-1)![0]).toBe('real-all')
    expect(groups.at(-1)![1].map(file => file.id)).toEqual(['real'])
    expect(groups.filter(([id]) => id.startsWith('stress-'))).toHaveLength(10)
    const entities = first.find(file => file.pressureId === 'stress-entities-1024')!
    expect(entities.features).toContain('entities')
    expect(entities.source.match(/<view /g)).toHaveLength(1024)
    expect(entities.source).toContain('data-decimal="&#65;&#160;"')
    expect(original.features).toBeUndefined()
  })

  it('appends the complete real aggregate after every unchanged category in original input order', () => {
    const small: Fixture = { id: 'small', sha256: 'small', source: '<view/>', bytes: 7, origins: ['small.wxml'], platform: 'weapp', cohort: 'shared', size: 'small', features: ['attributes-dense', 'interpolation', 'entities', 'script', 'web'] }
    const wxml: Fixture = { ...small, id: 'wxml', sha256: 'wxml', cohort: 'wxml', features: ['script'] }
    const medium: Fixture = { ...small, id: 'medium', sha256: 'medium', size: 'medium', features: [] }
    const large: Fixture = { ...small, id: 'large', sha256: 'large', size: 'large', features: [] }
    const synthetic: Fixture = { ...small, id: 'synthetic', sha256: 'synthetic', synthetic: true, pressureId: 'stress-fixed' }
    const groups = cohorts([small, wxml, medium, synthetic, large])
    expect(groups.map(([id]) => id)).toEqual(['shared', 'shared-small', 'shared-medium', 'shared-large', 'shared-attributes-dense', 'shared-interpolation', 'shared-entities', 'shared-script', 'shared-web', 'wxml', 'wxml-script', 'stress-fixed', 'real-all'])
    expect(groups.at(-1)![1].map(file => file.id)).toEqual(['small', 'wxml', 'medium', 'large'])
    expect(groups.find(([id]) => id === 'shared')![1].map(file => file.id)).toEqual(['small', 'medium', 'large'])
  })
})
