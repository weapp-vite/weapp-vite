import { describe, expect, it } from 'vitest'
import { parseJsLike } from '../../../../../utils/babel'
import { resolveSetupPropConflicts } from './index'

function analyze(script: string) {
  return resolveSetupPropConflicts({
    script,
    bindings: { haveNext: 'setup-ref', havePrev: 'setup-ref' },
    getScriptAst: () => parseJsLike(script),
    filename: 'src/navigation.vue',
  })
}

describe('compiled options ownership', () => {
  it.each([
    ['direct options', 'const options = { props: { ...{ max: Number } } }; export default options'],
    ['options alias', 'const options = { props: { ...{ max: Number } } }; const alias = options; export default alias'],
    ['typed alias', 'const options = { props: { ...{ max: Number } } }; export default (options as object) satisfies object'],
    ['exported spread', 'const options = { props: { ...{ max: Number } } }; export default { ...options }'],
    ['framework factory', 'import { defineComponent as component } from "vue"; const options = { props: { ...{ max: Number } } }; export default component(options)'],
    ['compiler merge', 'const options = { props: { ...{ max: Number } } }; export default Object.assign(options, { setup() {} })'],
  ])('preserves %s', async (_kind, script) => {
    expect((await analyze(script)).conflicts).toEqual([])
  })

  it.each([
    ['member mutation', 'const options = { props: { ...{ max: Number } } }; options.props = other; export default options'],
    ['member deletion', 'const options = { props: { ...{ max: Number } } }; delete options.props; export default options'],
    ['opaque escape', 'const options = { props: { ...{ max: Number } } }; mutate(options); export default options'],
    ['alias escape', 'const options = { props: { ...{ max: Number } } }; const alias = options; mutate(alias); export default options'],
    ['shallow-copy escape', 'const options = { props: { ...{ max: Number } } }; const copy = { ...options }; mutate(copy.props); export default options'],
    ['earlier assign', 'const options = { props: { ...{ max: Number } } }; Object.assign(options, other); export default options'],
    ['named export escape', 'export const options = { props: { ...{ max: Number } } }; export default options'],
    ['opaque wrapper', 'export default wrap({ props: { ...{ max: Number } } })'],
    ['unknown later override', 'import defaults from "./unknown"; export default Object.assign({}, { props: { max: Number } }, defaults)'],
    ['unknown earlier source', 'import defaults from "./unknown"; export default Object.assign({}, defaults, { props: { max: Number } })'],
    ['target setter', 'const target = { set props(value) { this.changed = value } }; export default Object.assign(target, { props: { ...{ max: Number } } })'],
    ['source getter', 'const source = { get props() { mutate(); return {} } }; export default Object.assign({}, source, { props: { ...{ max: Number } } })'],
    ['unknown target', 'import target from "./unknown"; export default Object.assign(target, { props: { ...{ max: Number } } })'],
    ['target prototype', 'const target = { __proto__: inherited }; export default Object.assign(target, { props: { ...{ max: Number } } })'],
    ['dynamic earlier key', 'export default Object.assign({ [getKey()]: value }, { props: { ...{ max: Number } } })'],
    ['getter options', 'export default { get props() { return { max: Number } } }'],
  ])('keeps conservative projection for %s', async (_kind, script) => {
    expect((await analyze(script)).conflicts).toEqual(['haveNext', 'havePrev'])
  })
})
