import { describe, expect, it } from 'vitest'
import { getLanguageProfile } from '../profiles'
import { scanTemplateWithProfile } from './scanner'

describe('bound language profile scanning', () => {
  it('observes in-place changes to caller-owned raw tags', () => {
    const rawTags = ['custom-script']
    const profile = { ...getLanguageProfile('weapp'), rawTags }
    const source = '<custom-script><view/></custom-script>'
    const names = () => scanTemplateWithProfile(source, profile, 'xml').tokens.filter(token => token.kind === 'tag').map(token => token.name)
    expect(names()).toEqual(['custom-script', 'custom-script'])
    rawTags[0] = 'other-script'
    expect(names()).toEqual(['custom-script', 'view', 'custom-script'])
    rawTags.length = 0
    rawTags.push('custom-script')
    expect(names()).toEqual(['custom-script', 'custom-script'])
  })
})
