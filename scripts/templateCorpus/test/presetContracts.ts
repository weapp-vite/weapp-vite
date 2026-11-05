import type { PlatformPresetId, TemplatePreset, TemplateScriptModule } from '../../../packages/wxml/src/presets/types'
import type { EntryContractReport } from './entryContracts'
import { equal, invariant } from '../assertions/types'

type PresetModule = typeof import('../../../packages/wxml/src/presets')
type ScriptExpectation = [extension: string, tag: string, format: 'commonjs' | 'esm', source: string, name: string]
interface PresetExpectation {
  extension: string
  style: string
  prefix: string
  rawTags: string[]
  script: ScriptExpectation
  native?: ScriptExpectation[]
}

const expected: Record<PlatformPresetId, PresetExpectation> = {
  weapp: { extension: '.wxml', style: '.wxss', prefix: 'wx', rawTags: ['wxs'], script: ['wxs', 'wxs', 'commonjs', 'src', 'module'] },
  alipay: { extension: '.axml', style: '.acss', prefix: 'a', rawTags: ['import-sjs'], script: ['sjs', 'import-sjs', 'esm', 'from', 'name'] },
  tt: { extension: '.ttml', style: '.ttss', prefix: 'tt', rawTags: ['sjs'], script: ['sjs', 'sjs', 'commonjs', 'src', 'module'] },
  swan: { extension: '.swan', style: '.css', prefix: 's', rawTags: ['import-sjs', 'filter'], script: ['sjs', 'import-sjs', 'esm', 'src', 'module'] },
  jd: { extension: '.jxml', style: '.jxss', prefix: 'wx', rawTags: ['wxs', 'jds'], script: ['wxs', 'wxs', 'commonjs', 'src', 'module'], native: [['jds', 'jds', 'commonjs', 'src', 'module']] },
  xhs: { extension: '.xhsml', style: '.css', prefix: 'wx', rawTags: ['wxs'], script: ['wxs', 'wxs', 'commonjs', 'src', 'module'] },
  qq: { extension: '.qml', style: '.qss', prefix: 'qq', rawTags: ['wxs', 'qs'], script: ['wxs', 'wxs', 'commonjs', 'src', 'module'], native: [['qs', 'qs', 'commonjs', 'src', 'module']] },
  ks: { extension: '.ksml', style: '.css', prefix: 'ks', rawTags: ['ks'], script: ['ks', 'ks', 'commonjs', 'src', 'module'] },
  ty: { extension: '.tyml', style: '.tyss', prefix: 'ty', rawTags: ['sjs'], script: ['sjs', 'sjs', 'commonjs', 'src', 'module'] },
}

function scriptShape(script: TemplateScriptModule): ScriptExpectation {
  return [script.extension, script.tag, script.format, script.sourceAttribute, script.moduleAttribute]
}

function assertFrozen(value: unknown, label: string, seen = new Set<object>()) {
  if (!value || typeof value !== 'object' || seen.has(value)) {
    return
  }
  seen.add(value)
  invariant(Object.isFrozen(value), 'presets-entry', `${label} is mutable`)
  for (const [key, child] of Object.entries(value)) {
    assertFrozen(child, `${label}.${key}`, seen)
  }
}

function assertPreset(preset: TemplatePreset, id: PlatformPresetId) {
  const fixture = expected[id]
  const syntax = id === 'weapp' ? 'legacy' : 'xml'
  const separator = id === 'swan' ? '-' : ':'
  equal([preset.id, preset.templateExtension, preset.styleExtension, preset.directivePrefix, preset.directiveSeparator, preset.eventStyle], [id, fixture.extension, fixture.style, fixture.prefix, separator, id === 'alipay' ? 'alipay' : 'default'], 'presets-entry', `platform metadata changed for ${id}`)
  invariant(preset.dialect === preset.nativeDialect, 'presets-entry', `native dialect alias changed for ${id}`)
  equal(preset.nativeDialect, { id: `${id}-native`, syntax, rawTags: fixture.rawTags }, 'presets-entry', `native dialect changed for ${id}`)
  equal(preset.compatibilityDialect, { id: `${id}-compatibility`, syntax, rawTags: ['wxs', 'sjs', 'ks', 'filter', 'script', 'import-sjs', ...(fixture.native ?? []).map(script => script[1])] }, 'presets-entry', `compatibility dialect changed for ${id}`)
  equal(scriptShape(preset.portableScriptModule), fixture.script, 'presets-entry', `portable script module changed for ${id}`)
  equal(preset.nativeScriptModules.map(scriptShape), fixture.native ?? [], 'presets-entry', `native script modules changed for ${id}`)
  equal(preset.directives, Object.fromEntries(['if', 'elif', 'else', 'for', 'for-item', 'for-index', 'key'].map(suffix => [suffix.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), `${fixture.prefix}${separator}${suffix}`])), 'presets-entry', `directives changed for ${id}`)
  assertFrozen(preset, id)
}

/** 对真实 presets 入口执行独立字面契约，避免源码预设与构建转发同时漂移时自证正确。 */
export function runPresetContracts(value: unknown): EntryContractReport {
  const report: EntryContractReport = { accepted: true, checks: [], failures: [] }
  const check = (name: string, action: () => void) => {
    report.checks.push(name)
    try {
      action()
    }
    catch (error) {
      report.accepted = false
      report.failures.push({ check: name, message: error instanceof Error ? error.message : String(error) })
    }
  }
  check('presets-public-surface', () => {
    invariant(value !== null && typeof value === 'object', 'presets-entry', 'presets entry must be a module object')
    invariant(typeof Reflect.get(value, 'getTemplatePreset') === 'function', 'presets-entry', 'missing getTemplatePreset')
    for (const name of ['compileDialect', 'createParser', 'parse', 'scan', 'edit', 'walk']) {
      invariant(!Reflect.has(value, name), 'presets-entry', `presets exposes core function: ${name}`)
    }
  })
  const module = value as PresetModule
  check('presets-native-compatibility-and-freezing', () => {
    const ids = Object.keys(expected) as PlatformPresetId[]
    equal(module.presets.map(preset => preset.id), ids, 'presets-entry', 'registered preset order changed')
    assertFrozen(module.presets, 'presets')
    for (const id of ids) {
      const preset = module.getTemplatePreset(id)
      invariant(preset === module[id] && preset === module.presets.find(candidate => candidate.id === id), 'presets-entry', `preset export identity changed for ${id}`)
      assertPreset(preset, id)
    }
  })
  check('presets-input-recipes-and-freezing', () => {
    const recipe = module.defaultTemplateInputRecipe
    const references = module.portableCompatibilityScriptRecipes
    invariant(recipe.defaultScriptModule === module.weapp.portableScriptModule && recipe.scriptReferences === references, 'presets-entry', 'default recipe aliases changed')
    equal(recipe.rawTags, ['wxs', 'sjs', 'filter', 'import-sjs'], 'presets-entry', 'default recipe raw tags changed')
    equal(recipe.scriptModules.map(scriptShape), [['wxs', 'wxs', 'commonjs', 'src', 'module'], ['sjs', 'sjs', 'commonjs', 'src', 'module']], 'presets-entry', 'default recipe modules changed')
    equal(references, [{ tag: 'wxs', sourceAttributes: ['src'] }, { tag: 'sjs', sourceAttributes: ['src'] }, { tag: 'filter', sourceAttributes: ['src'] }, { tag: 'import-sjs', sourceAttributes: ['from'] }], 'presets-entry', 'portable script references changed')
    const legacy = module.legacyScriptModuleRecipes
    invariant(legacy.platform === recipe && legacy.unprofiled.defaultScriptModule === module.weapp.portableScriptModule, 'presets-entry', 'legacy recipe aliases changed')
    equal(legacy.unprofiled.scriptModules.map(scriptShape), [['wxs', 'wxs', 'commonjs', 'src', 'module'], ['sjs', 'sjs', 'esm', 'src', 'module']], 'presets-entry', 'legacy unprofiled modules changed')
    assertFrozen(recipe, 'defaultTemplateInputRecipe')
    assertFrozen(references, 'portableCompatibilityScriptRecipes')
    assertFrozen(legacy, 'legacyScriptModuleRecipes')
  })
  return report
}
