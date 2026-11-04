import { describe, expect, it } from 'vitest'
import { getLanguageFileAssociations, getLanguageProfile, isScriptModuleFile } from './index'

describe('native script module profiles', () => {
  it.each([['jd', 'jds'], ['qq', 'qs']] as const)('recognizes %s native %s module tags and source extensions', (platform, tag) => {
    expect(getLanguageProfile(platform).rawTags).toContain(tag)
    expect(getLanguageProfile(platform).scriptExtensions).toContain(`.${tag}`)
    expect(isScriptModuleFile(`module.${tag}`)).toBe(true)
    expect(isScriptModuleFile(`module.${tag}.ts`)).toBe(true)
    expect(getLanguageFileAssociations()[`*.${tag}`]).toBe('miniprogram-script')
  })

  it('keeps platform-owned tags out of unrelated language profiles', () => {
    expect(getLanguageProfile('weapp').rawTags).not.toContain('jds')
    expect(getLanguageProfile('weapp').rawTags).not.toContain('qs')
  })
})
