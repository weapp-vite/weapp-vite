import { describe, expect, it } from 'vitest'
import { defaultTemplateInputRecipe, getTemplatePreset, legacyScriptModuleRecipes, portableCompatibilityScriptRecipes, presets } from './index'

describe('template presets', () => {
  it('exposes every registered template platform without build claims', () => {
    expect(presets.map(preset => preset.id)).toEqual(['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs', 'qq', 'ks', 'ty'])
    expect(getTemplatePreset('weapp').compatibilityDialect).toMatchObject({ id: 'weapp-compatibility', syntax: 'legacy' })
    expect(getTemplatePreset('alipay').compatibilityDialect.syntax).toBe('xml')
  })

  it('keeps native aliases separate from portable script modules', () => {
    expect(getTemplatePreset('jd').portableScriptModule.tag).toBe('wxs')
    expect(getTemplatePreset('jd').nativeScriptModules).toEqual([{ extension: 'jds', tag: 'jds', format: 'commonjs', sourceAttribute: 'src', moduleAttribute: 'module' }])
    expect(getTemplatePreset('qq').nativeScriptModules[0]?.tag).toBe('qs')
  })

  it('describes portable compatibility inputs without changing native presets', () => {
    expect(defaultTemplateInputRecipe.rawTags).toEqual(['wxs', 'sjs', 'filter', 'import-sjs'])
    expect(defaultTemplateInputRecipe.scriptModules.map(module => [module.extension, module.tag])).toEqual([['wxs', 'wxs'], ['sjs', 'sjs']])
    expect(defaultTemplateInputRecipe.defaultScriptModule).toBe(getTemplatePreset('weapp').portableScriptModule)
    expect(defaultTemplateInputRecipe.scriptReferences).toBe(portableCompatibilityScriptRecipes)
    expect(portableCompatibilityScriptRecipes).toEqual([
      { tag: 'wxs', sourceAttributes: ['src'] },
      { tag: 'sjs', sourceAttributes: ['src'] },
      { tag: 'filter', sourceAttributes: ['src'] },
      { tag: 'import-sjs', sourceAttributes: ['from'] },
    ])
    expect(Object.isFrozen(defaultTemplateInputRecipe)).toBe(true)
    expect(Object.isFrozen(defaultTemplateInputRecipe.scriptModules)).toBe(true)
    expect(portableCompatibilityScriptRecipes.every(recipe => Object.isFrozen(recipe) && Object.isFrozen(recipe.sourceAttributes))).toBe(true)
  })

  it('retains the legacy unprofiled SJS format separately from platform fallbacks', () => {
    expect(legacyScriptModuleRecipes.unprofiled.scriptModules.find(module => module.extension === 'sjs')).toMatchObject({ tag: 'sjs', format: 'esm', sourceAttribute: 'src', moduleAttribute: 'module' })
    expect(legacyScriptModuleRecipes.platform.scriptModules.find(module => module.extension === 'sjs')).toMatchObject({ tag: 'sjs', format: 'commonjs', sourceAttribute: 'src', moduleAttribute: 'module' })
    expect(legacyScriptModuleRecipes.unprofiled.defaultScriptModule).toBe(getTemplatePreset('weapp').portableScriptModule)
    expect(legacyScriptModuleRecipes.platform).toBe(defaultTemplateInputRecipe)
    expect(Object.isFrozen(legacyScriptModuleRecipes)).toBe(true)
    expect(Object.isFrozen(legacyScriptModuleRecipes.unprofiled.scriptModules)).toBe(true)
  })

  it.each([
    ['weapp', ['wxs']],
    ['alipay', ['import-sjs']],
    ['tt', ['sjs']],
    ['swan', ['import-sjs', 'filter']],
    ['jd', ['wxs', 'jds']],
    ['xhs', ['wxs']],
    ['qq', ['wxs', 'qs']],
    ['ks', ['ks']],
    ['ty', ['sjs']],
  ] as const)('keeps %s native raw tags exact and compatibility tags explicit', (platform, rawTags) => {
    const preset = getTemplatePreset(platform)
    expect(preset.dialect).toBe(preset.nativeDialect)
    expect(preset.dialect.rawTags).toEqual(rawTags)
    expect(preset.compatibilityDialect.rawTags).toEqual([
      'wxs',
      'sjs',
      'ks',
      'filter',
      'script',
      'import-sjs',
      ...(platform === 'jd' ? ['jds'] : platform === 'qq' ? ['qs'] : []),
    ])
    expect(preset.dialect.syntax).toBe(platform === 'weapp' ? 'legacy' : 'xml')
    expect(Object.isFrozen(preset)).toBe(true)
    expect(Object.isFrozen(preset.dialect)).toBe(true)
    expect(Object.isFrozen(preset.dialect.rawTags)).toBe(true)
    expect(Object.isFrozen(preset.portableScriptModule)).toBe(true)
    expect(Object.isFrozen(preset.directives)).toBe(true)
  })
})
