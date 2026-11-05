import { describe, expect, it } from 'vitest'
import * as core from '../../../packages/wxml/src/core'
import * as presets from '../../../packages/wxml/src/presets'
import { runPresetContracts } from './presetContracts'

describe('standalone preset entry contracts', () => {
  it('checks actual source exports against independent values and deep immutability', () => {
    expect(runPresetContracts(presets)).toMatchObject({ accepted: true, checks: ['presets-public-surface', 'presets-native-compatibility-and-freezing', 'presets-input-recipes-and-freezing'], failures: [] })
  })

  it('rejects a parser entry or missing standalone exports', () => {
    expect(runPresetContracts(core).accepted).toBe(false)
    expect(runPresetContracts({ ...presets, weapp: undefined }).failures).toContainEqual(expect.objectContaining({ check: 'presets-native-compatibility-and-freezing' }))
  })

  it('rejects swapped forwarding exports and native dialect drift', () => {
    expect(runPresetContracts({ ...presets, alipay: presets.swan }).accepted).toBe(false)
    const changed = Object.freeze({ ...presets.jd, directivePrefix: 'jd' })
    const module = { ...presets, jd: changed, presets: Object.freeze(presets.presets.map(preset => preset.id === 'jd' ? changed : preset)), getTemplatePreset: (id: string) => id === 'jd' ? changed : presets.getTemplatePreset(id as never) }
    expect(runPresetContracts(module).failures).toContainEqual(expect.objectContaining({ check: 'presets-native-compatibility-and-freezing' }))
  })

  it('rejects mutable nested recipe arrays even when all values match', () => {
    const changed = Object.freeze({ ...presets.legacyScriptModuleRecipes.unprofiled, scriptModules: [...presets.legacyScriptModuleRecipes.unprofiled.scriptModules] })
    const legacyScriptModuleRecipes = Object.freeze({ ...presets.legacyScriptModuleRecipes, unprofiled: changed })
    expect(runPresetContracts({ ...presets, legacyScriptModuleRecipes }).failures).toContainEqual(expect.objectContaining({ check: 'presets-input-recipes-and-freezing' }))
  })
})
