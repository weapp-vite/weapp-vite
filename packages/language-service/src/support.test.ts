import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { getLanguageFileAssociations, isScriptModuleFile, languageProfiles, resolveLanguageProfile } from './profiles'
import { getLanguageSupportMatrix, languageSupportCases } from './support'

describe('auditable language support matrix', () => {
  it('covers every registered platform, extension and executable case ID', async () => {
    const matrix = getLanguageSupportMatrix()
    expect(matrix.map(row => row.platform)).toEqual(languageProfiles.map(profile => profile.platform))
    expect(new Set(languageSupportCases.map(testCase => testCase.id)).size).toBe(languageSupportCases.length)
    for (const testCase of languageSupportCases) {
      const source = await readFile(new URL(`../../../${testCase.test}`, import.meta.url), 'utf8')
      expect(source).toContain(`describe('${testCase.suite}'`)
    }
    for (const row of matrix) {
      expect(row.cases).toEqual(languageSupportCases.map(testCase => testCase.id))
      expect(row.templateExtensions.length).toBeGreaterThan(0)
      expect(row.styleExtensions.length).toBeGreaterThan(0)
      expect(row.scriptExtensions.length).toBeGreaterThan(0)
      expect(row.filterExtensions).toEqual(row.platform === 'swan' ? ['.filter.js', '.filter.ts'] : [])
    }
  })

  it('shares associations without generating double extensions for Baidu Filter', () => {
    const associations = getLanguageFileAssociations()
    expect(associations['*.wxml']).toBe('wxml')
    expect(associations['*.axml']).toBe('miniprogram-template')
    expect(associations['*.tyss']).toBe('css')
    expect(associations['*.ks.ts']).toBe('miniprogram-script')
    expect(associations['*.filter.js']).toBe('miniprogram-script')
    expect(associations['*.filter.ts']).toBe('miniprogram-script')
    expect(associations['*.filter.js.ts']).toBeUndefined()
    expect(isScriptModuleFile('src/filter.filter.js')).toBe(true)
    expect(isScriptModuleFile('src/filter.filter.ts')).toBe(true)
    expect(resolveLanguageProfile('src/filter.filter.js')?.platform).toBe('swan')
    expect(resolveLanguageProfile('src/filter.filter.ts')?.platform).toBe('swan')
    associations['*.wxml'] = 'changed'
    expect(getLanguageFileAssociations()['*.wxml']).toBe('wxml')
  })
})
