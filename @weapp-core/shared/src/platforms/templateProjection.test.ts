import { getTemplatePreset } from '@weapp-vite/wxml/presets'
import { describe, expect, it } from 'vitest'
import { getMiniProgramNativeScriptModules, getMiniProgramPlatformDescriptor, getMiniProgramScriptModuleOptions, getMiniProgramTemplateProjection, getSupportedMiniProgramPlatforms } from './index'

const scriptFallbacks = [
  { platform: 'weapp', expected: { tag: 'wxs', format: 'commonjs', sourceAttribute: 'src', moduleAttribute: 'module' } },
  { platform: 'alipay', expected: { tag: 'wxs', format: 'esm', sourceAttribute: 'from', moduleAttribute: 'name' } },
  { platform: 'swan', expected: { tag: 'wxs', format: 'esm', sourceAttribute: 'src', moduleAttribute: 'module' } },
  { platform: 'jd', expected: { tag: 'wxs', format: 'commonjs', sourceAttribute: 'src', moduleAttribute: 'module' } },
] as const

describe('mini program template projection', () => {
  it('keeps portable and native JD script contracts separate', () => {
    const projection = getMiniProgramTemplateProjection('jd')
    expect(projection.templateExtension).toBe('.jxml')
    expect(projection.portableScriptModule.tag).toBe('wxs')
    expect(projection.nativeScriptModules).toEqual([{ extension: 'jds', tag: 'jds', format: 'commonjs', sourceAttribute: 'src', moduleAttribute: 'module' }])
    expect(projection.compatibilityRawTags).toContain('jds')
  })

  it('preserves platform syntax, directives and SJS attributes', () => {
    const alipay = getMiniProgramTemplateProjection('alipay')
    expect(alipay.syntax).toBe('xml')
    expect(alipay.directivePrefix).toBe('a')
    expect(alipay.portableScriptModule).toMatchObject({ tag: 'import-sjs', extension: 'sjs', sourceAttribute: 'from', moduleAttribute: 'name' })
    const weapp = getMiniProgramTemplateProjection('weapp')
    expect(weapp.syntax).toBe('legacy')
    expect(weapp.directiveSeparator).toBe(':')
  })

  it('projects template facts without expanding the six supported build platforms', () => {
    const platforms = getSupportedMiniProgramPlatforms()
    expect(platforms).toEqual(['weapp', 'alipay', 'swan', 'tt', 'jd', 'xhs'])
    for (const platform of platforms) {
      const preset = getTemplatePreset(platform)
      const projection = getMiniProgramTemplateProjection(platform)
      const descriptor = getMiniProgramPlatformDescriptor(platform)
      expect(getMiniProgramTemplateProjection(platform)).toBe(projection)
      expect(projection.compatibilityRawTags).toBe(preset.compatibilityDialect.rawTags)
      expect(projection.portableScriptModule).toEqual(preset.portableScriptModule)
      expect(projection.portableScriptModule).not.toBe(preset.portableScriptModule)
      expect(projection.nativeScriptModules).toEqual(preset.nativeScriptModules)
      expect(projection.nativeScriptModules).not.toBe(preset.nativeScriptModules)
      expect(descriptor.outputExtensions).toMatchObject({
        wxml: preset.templateExtension.slice(1),
        wxss: preset.styleExtension.slice(1),
        wxs: preset.portableScriptModule.extension,
      })
      expect(descriptor.wxml?.directivePrefix).toBe(preset.directivePrefix)
      expect(descriptor.wxml?.eventBindingStyle).toBe(preset.eventStyle)
    }
  })

  it('keeps shared script element assignments local to their mutable projection', () => {
    const preset = getTemplatePreset('jd')
    const descriptorModule = getMiniProgramNativeScriptModules('jd')[0]!
    const projection = getMiniProgramTemplateProjection('jd')
    const projectionModule = projection.nativeScriptModules[0]!
    const originalDescriptor = { ...descriptorModule }
    const originalNativeProjection = { ...projectionModule }
    const originalPortableProjection = { ...projection.portableScriptModule }
    try {
      descriptorModule.tag = 'local-jds'
      projectionModule.sourceAttribute = 'from'
      projection.portableScriptModule.tag = 'local-wxs'
      expect(getMiniProgramScriptModuleOptions('jd', 'jds').tag).toBe('local-jds')
      expect(preset.nativeScriptModules[0]).toMatchObject({ tag: 'jds', sourceAttribute: 'src' })
      expect(preset.portableScriptModule.tag).toBe('wxs')
      expect(descriptorModule.sourceAttribute).toBe('src')
      expect(projectionModule.tag).toBe('jds')
      expect(getSupportedMiniProgramPlatforms()).toEqual(['weapp', 'alipay', 'swan', 'tt', 'jd', 'xhs'])
    }
    finally {
      Object.assign(descriptorModule, originalDescriptor)
      Object.assign(projectionModule, originalNativeProjection)
      Object.assign(projection.portableScriptModule, originalPortableProjection)
    }
  })

  it('matches live native extensions and returns independent option values', () => {
    const module = getMiniProgramNativeScriptModules('jd')[0]!
    const original = { ...module }
    try {
      const before = getMiniProgramScriptModuleOptions('jd', 'jds')
      module.extension = 'local-script'
      module.tag = 'local-module'
      module.sourceAttribute = 'from'
      expect(getMiniProgramScriptModuleOptions('jd', '.local-script')).toEqual({ tag: 'local-module', format: 'commonjs', sourceAttribute: 'from', moduleAttribute: 'module' })
      expect(getMiniProgramScriptModuleOptions('jd', 'jds')).toEqual({ tag: 'wxs', format: 'commonjs', sourceAttribute: 'src', moduleAttribute: 'module' })
      expect(before).toEqual({ tag: 'jds', format: 'commonjs', sourceAttribute: 'src', moduleAttribute: 'module' })
      expect(getMiniProgramScriptModuleOptions('jd', 'wxs')).not.toBe(getMiniProgramScriptModuleOptions('jd', 'wxs'))
    }
    finally {
      Object.assign(module, original)
    }
  })

  it.each(scriptFallbacks)('ignores inherited script aliases for $platform', ({ platform, expected }) => {
    for (const extension of ['constructor', 'toString', '__proto__']) {
      expect(getMiniProgramScriptModuleOptions(platform, extension)).toEqual(expected)
      expect(getMiniProgramScriptModuleOptions(platform, `.${extension}`)).toEqual(expected)
    }
  })

  it.each(scriptFallbacks)('preserves explicit own script aliases for $platform', ({ platform, expected }) => {
    const descriptor = getMiniProgramPlatformDescriptor(platform)
    const original = Object.getOwnPropertyDescriptor(descriptor, 'scriptModuleTagByExtension')
    const aliases: Record<string, string> = Object.assign(Object.create({ inherited: 'inherited-script' }), descriptor.scriptModuleTagByExtension)
    for (const extension of ['constructor', 'toString', '__proto__']) {
      Object.defineProperty(aliases, extension, { value: `custom-${extension}`, enumerable: true })
    }
    try {
      descriptor.scriptModuleTagByExtension = aliases
      for (const extension of ['constructor', 'toString', '__proto__']) {
        const own = { ...expected, tag: `custom-${extension}` }
        expect(getMiniProgramScriptModuleOptions(platform, extension)).toEqual(own)
        expect(getMiniProgramScriptModuleOptions(platform, `.${extension}`)).toEqual(own)
      }
      expect(getMiniProgramScriptModuleOptions(platform, 'inherited')).toEqual(expected)
    }
    finally {
      if (original) {
        Object.defineProperty(descriptor, 'scriptModuleTagByExtension', original)
      }
      else {
        delete descriptor.scriptModuleTagByExtension
      }
    }
  })
})
