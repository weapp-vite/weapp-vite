import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { compileVueFile, refreshVueFileJsonConfig } from '../compileVueFile'
import { transformScript } from './index'

const absent = { kind: 'absent' }
const unknown = { kind: 'unknown' }
const known = (value: string | boolean | number | null | undefined) => ({ kind: 'known', value })
const defaults = { component: { options: { styleIsolation: 'apply-shared', addGlobalClass: true } } }

function metadata(source: string, withDefaults = false) {
  return transformScript(source, { isPage: true, sourceMap: false, ...(withDefaults ? { wevuDefaults: defaults } : {}) }).componentStyleOptions
}

describe('component style options metadata', () => {
  it('reads the emitted defaults and preserves explicit per-page overrides', () => {
    expect(metadata('export default {}', true)).toEqual({ styleIsolation: known('apply-shared'), addGlobalClass: known(true) })
    expect(metadata('export default { options: { styleIsolation: "isolated", addGlobalClass: false } }', true))
      .toEqual({ styleIsolation: known('isolated'), addGlobalClass: known(false) })
    expect(metadata('export default {}')).toEqual({ styleIsolation: absent, addGlobalClass: absent })
  })

  it('keeps missing fields distinct from explicit undefined and invalid primitive values', () => {
    expect(metadata('export default { options: { styleIsolation: undefined, addGlobalClass: null } }', true))
      .toEqual({ styleIsolation: known(undefined), addGlobalClass: known(null) })
    expect(metadata('export default { options: { styleIsolation: 0, addGlobalClass: "invalid" } }'))
      .toEqual({ styleIsolation: known(0), addGlobalClass: known('invalid') })
  })

  it('resolves nested local constants and spreads in override order', () => {
    expect(metadata(`
const isolation = 'isolated'
const base = { styleIsolation: 'apply-shared', addGlobalClass: true }
const options = { ...base, styleIsolation: isolation }
export default { options }
`, true)).toEqual({ styleIsolation: known('isolated'), addGlobalClass: known(true) })
    expect(metadata(`export default { options: { styleIsolation: 'apply-shared' }, ...{ options: { addGlobalClass: true } } }`))
      .toEqual({ styleIsolation: absent, addGlobalClass: known(true) })
  })

  it('does not infer defaults through dynamic spreads, but accepts a later explicit override', () => {
    expect(metadata(`import external from './external'; export default { options: { styleIsolation: 'apply-shared', ...external } }`, true))
      .toEqual({ styleIsolation: unknown, addGlobalClass: unknown })
    expect(metadata(`import external from './external'; export default { options: { ...external, styleIsolation: 'isolated' } }`, true))
      .toEqual({ styleIsolation: known('isolated'), addGlobalClass: unknown })
    expect(metadata(`import external from './external'; export default { ...external }`, true))
      .toBeUndefined()
  })

  it('rejects mutable or escaped options and never invokes getters or calls', () => {
    for (const source of [
      `const options = { styleIsolation: 'apply-shared' }; options.styleIsolation = 'isolated'; export default { options }`,
      `const options = { styleIsolation: 'apply-shared' }; mutate(options); export default { options }`,
      `const options = { styleIsolation: 'apply-shared' }; const wrapper = { options }; mutate(wrapper); export default { options }`,
      `export default { get options() { throw new Error('never execute') } }`,
      `export default { options: readOptions() }`,
    ]) {
      expect(metadata(source)).toEqual({ styleIsolation: unknown, addGlobalClass: unknown })
    }
  })

  it('handles computed and duplicate properties without selecting a stale earlier value', () => {
    expect(metadata(`export default { options: { styleIsolation: 'apply-shared', ['styleIsolation']: 'isolated' } }`))
      .toEqual({ styleIsolation: known('isolated'), addGlobalClass: absent })
    expect(metadata(`export default { options: { styleIsolation: 'apply-shared', [dynamicKey]: 'isolated' } }`))
      .toEqual({ styleIsolation: unknown, addGlobalClass: unknown })
    expect(metadata(`export default { options: { styleIsolation: 'apply-shared', styleIsolation: 'isolated' } }`))
      .toEqual({ styleIsolation: known('isolated'), addGlobalClass: absent })
  })

  it('reads all Object.assign operands and conservatively handles inherited options', () => {
    expect(metadata(`export default Object.assign({ options: { styleIsolation: 'apply-shared' } }, { options: { addGlobalClass: false } })`))
      .toEqual({ styleIsolation: absent, addGlobalClass: known(false) })
    expect(metadata(`export default { mixins: [external] }`)).toBeUndefined()
    expect(metadata(`export default { mixins: [external], options: { styleIsolation: 'isolated' } }`))
      .toBeUndefined()
  })

  it('does not infer style options when definition filters can mutate registration', () => {
    for (const source of [
      `export default { behaviors: [external], options: { styleIsolation: 'apply-shared' } }`,
      `export default { definitionFilter() {}, options: { styleIsolation: 'apply-shared' } }`,
      `export default { extends: external, options: { styleIsolation: 'apply-shared' } }`,
      `export default { mixins: [external], options: { styleIsolation: 'apply-shared' } }`,
      `export default { __proto__: external, options: { styleIsolation: 'apply-shared' } }`,
    ]) {
      expect(metadata(source)).toBeUndefined()
    }
  })

  it('does not infer registration through assign accessor or prototype side effects', () => {
    for (const source of [
      `export default Object.assign({ options: { styleIsolation: 'apply-shared' }, set other(v) { this.options.styleIsolation = 'isolated' } }, { other: true })`,
      `export default Object.assign({ options: { styleIsolation: 'apply-shared' } }, { get other() { mutateOptions(); return true } })`,
      `export default Object.assign({ __proto__: external, options: { styleIsolation: 'apply-shared' } }, { other: true })`,
      `export default Object.assign({ [readKey()]: true, options: { styleIsolation: 'apply-shared' } }, { other: true })`,
    ]) {
      expect(metadata(source)).toBeUndefined()
    }
  })

  it('observes the target setter changing a different option during assignment', () => {
    const expression = `Object.assign({ options: { styleIsolation: 'apply-shared' }, set other(v) { this.options.styleIsolation = 'isolated' } }, { other: true })`
    expect(runInNewContext(expression).options.styleIsolation).toBe('isolated')
    expect(metadata(`export default ${expression}`)).toBeUndefined()
  })

  it.each(['direct', 'nested', 'constant'] as const)('observes a %s spread getter mutating style options before registration', (scenario) => {
    const operand = `{ options: { styleIsolation: 'apply-shared' }, get mutate() { this.options.styleIsolation = 'isolated'; return true } }`
    const expression = scenario === 'nested' ? `({ ...{ ...${operand} } })` : `({ ...${operand} })`
    expect(runInNewContext(expression).options.styleIsolation).toBe('isolated')
    const source = scenario === 'constant' ? `const base = ${operand}; export default { ...base }` : `export default ${expression}`
    expect(metadata(source)).toBeUndefined()
  })

  it('merges defaults into static computed options before reading metadata', () => {
    expect(metadata(`export default { ['options']: { styleIsolation: 'isolated' } }`, true))
      .toEqual({ styleIsolation: known('isolated'), addGlobalClass: known(true) })
  })

  it('preserves metadata for compact scripts and omits it for App registration', () => {
    expect(transformScript(`export default { options: { styleIsolation: 'apply-shared' } }`, { isPage: true, minify: true }).componentStyleOptions)
      .toEqual({ styleIsolation: known('apply-shared'), addGlobalClass: absent })
    expect(transformScript('export default {}', { isApp: true }).componentStyleOptions).toBeUndefined()
    expect(transformScript('export default {}', { skipComponentTransform: true }).componentStyleOptions).toBeUndefined()
    expect(transformScript('Page({ options: { styleIsolation: \'apply-shared\' } })', { isPage: true }).componentStyleOptions).toBeUndefined()
    expect(transformScript('export default resolveUnknown()', { isPage: true }).componentStyleOptions).toBeUndefined()
  })

  it('carries resolved script options through SFC compilation and JSON-only refresh', async () => {
    const source = `<script setup>
defineOptions({ options: { styleIsolation: 'isolated', addGlobalClass: false } })
definePageJson({ styleIsolation: 'apply-shared' })
</script><template><view>scoped</view></template>`
    const options = { isPage: true, wevuDefaults: defaults }
    const result = await compileVueFile(source, 'pages/index/index.vue', options)
    expect(result.meta?.componentStyleOptions).toEqual({ styleIsolation: known('isolated'), addGlobalClass: known(false) })
    const refreshed = await refreshVueFileJsonConfig(source.replace('definePageJson({ styleIsolation: \'apply-shared\' })', 'definePageJson({ styleIsolation: \'page-isolated\' })'), 'pages/index/index.vue', result, options)
    expect(refreshed?.meta?.componentStyleOptions).toEqual(result.meta?.componentStyleOptions)
    expect(JSON.parse(refreshed!.config!).styleIsolation).toBe('page-isolated')
  })
})
