import { describe, expect, it } from 'vitest'
import { languageProfiles } from '../profiles'
import { getComponentAttributes, getComponentNames, getComponentSchema } from './index'

describe('platform component snapshots', () => {
  it.each(languageProfiles)('ships $platform component metadata with its own source', (profile) => {
    const schema = getComponentSchema(profile.platform)
    expect(schema.platform).toBe(profile.platform)
    expect(schema.availability).toBe('snapshot')
    expect(schema.version).toMatch(/^sha256:[a-f\d]{64}$/)
    expect(schema.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(schema.components.length).toBeGreaterThan(20)
    expect(new Set(getComponentNames(profile.platform)).size).toBe(schema.components.length)
    expect(getComponentAttributes(profile.platform, 'view').some(attribute => attribute.name === 'hover-class')).toBe(true)
    expect(getComponentAttributes(profile.platform, 'user-custom-component')).toEqual([])
    for (const component of schema.components) {
      expect(component.docLink).toMatch(/^https:\/\//)
      expect(Array.isArray(component.attrs)).toBe(true)
      expect(component.attrs.every(attribute => typeof attribute.name === 'string')).toBe(true)
    }
  })

  it('keeps independent platform attribute tables and provenance', () => {
    expect(getComponentAttributes('alipay', 'view').some(attribute => attribute.name === 'disable-scroll')).toBe(true)
    expect(getComponentAttributes('weapp', 'view').some(attribute => attribute.name === 'disable-scroll')).toBe(false)
    expect(getComponentSchema('ty').source).toContain('tuya.com')
    expect(getComponentSchema('swan').source).toContain('baidu.com')
    expect(getComponentSchema('qq').source).toContain('q.qq.com')
  })
})
