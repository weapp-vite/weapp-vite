import path from 'node:path'
import { parse } from '@babel/parser'
import { describe, expect, it } from 'vitest'
import { compileStyle, parse as parseSfc } from 'vue/compiler-sfc'
import {
  injectReactTemplateMarker,
  injectVueStyleRule,
  isDynamicReactTemplate,
  isReactTemplateSource,
  parseStatefulHmrControlSource,
  resolveHmrScriptOutputPath,
  resolveReactTemplateOutputPath,
  resolveWorkspaceHmrRuntime,
} from './workspace-hmr/scenarios'

describe('workspace HMR script output', () => {
  it('detects the runtime from the stateful control artifact', () => {
    expect(resolveWorkspaceHmrRuntime(true)).toBe('stateful')
    expect(resolveWorkspaceHmrRuntime(false)).toBe('standard')
  })

  it('parses the generated stateful control assignment', () => {
    expect(parseStatefulHmrControlSource(
      'globalThis["__CONTROL__"] = {"buildId":"build-a","token":"token-a","url":"http://127.0.0.1:3000/hmr"};\n',
    )).toEqual({
      buildId: 'build-a',
      token: 'token-a',
      url: 'http://127.0.0.1:3000/hmr',
    })
  })

  it('uses the stateful delta artifact for script scenarios', () => {
    expect(resolveHmrScriptOutputPath({
      distRoot: path.join('project', 'dist'),
      hmrRuntime: 'stateful',
      sourceRoot: path.join('project', 'src'),
    }, path.join('project', 'src', 'pages', 'index.ts'))).toBe(
      path.join('project', 'dist', '__weapp_vite_hmr', 'update.js'),
    )
  })

  it('keeps the entry output for standard script scenarios', () => {
    expect(resolveHmrScriptOutputPath({
      distRoot: path.join('project', 'dist'),
      hmrRuntime: 'standard',
      sourceRoot: path.join('project', 'src'),
    }, path.join('project', 'src', 'pages', 'index.ts'))).toBe(
      path.join('project', 'dist', 'pages', 'index.js'),
    )
  })

  it('maps a React view owner to its page WXML output', () => {
    const project = {
      distRoot: path.join('project', 'dist'),
      sourceRoot: path.join('project', 'src'),
    }
    const sourcePath = path.join('project', 'src', 'pages', 'index', 'view.tsx')

    expect(isReactTemplateSource(sourcePath)).toBe(true)
    expect(resolveReactTemplateOutputPath(project, sourcePath)).toBe(
      path.join('project', 'dist', 'pages', 'index', 'index.wxml'),
    )
    expect(injectReactTemplateMarker(
      'export function View() { return <View className="page">hello</View> }',
      'HMR_MARKER',
    )).toContain('<View className="page" data-hmr-marker="HMR_MARKER">')
  })
})

describe('workspace HMR source mutations', () => {
  it('mutates JSX after generic calls without corrupting TypeScript', () => {
    const source = `
interface LeafProps { label: string }
const Leaf = createNativeComponent<LeafProps>('native-leaf')
export const Page = forwardRef<Controller, { count: number }>((props, ref) => {
  const example = '<Fake label="not JSX">'
  return <View title={props.count > 1 ? 'many' : 'one'}><Leaf label={example} /></View>
})`
    const mutated = injectReactTemplateMarker(source, 'HMR_MARKER')
    expect(mutated).toContain('createNativeComponent<LeafProps>')
    expect(mutated).toContain('forwardRef<Controller, { count: number }>')
    expect(mutated).toContain('\'<Fake label="not JSX">\'')
    expect(mutated).toContain('<View title={props.count > 1 ? \'many\' : \'one\'} data-hmr-marker="HMR_MARKER">')
    expect(() => parse(mutated, { sourceType: 'module', plugins: ['typescript', 'jsx'] })).not.toThrow()
  })

  it('supports self-closing JSX without selecting a fragment or generic', () => {
    const mutated = injectReactTemplateMarker('const make = <T,>(value: T) => <><View value={value}/></>', 'HMR_MARKER')
    expect(mutated).toContain('<View value={value} data-hmr-marker="HMR_MARKER"/>')
    expect(() => parse(mutated, { plugins: ['typescript', 'jsx'] })).not.toThrow()
    expect(() => injectReactTemplateMarker('const value = call<Type>()', 'HMR_MARKER')).toThrow('requires a JSX element')
  })

  it('distinguishes fixed dynamic templates from compiled static templates', () => {
    expect(isDynamicReactTemplate('<import src="../../runtime/base.wxml" />\n<template is="react_root" data="{{root:root}}" />')).toBe(true)
    expect(isDynamicReactTemplate('<view class="page"><text>{{slots.s0.text}}</text></view>')).toBe(false)
  })

  it('preserves npm style sources and emits the new rule in a separate valid block', () => {
    const external = '<style src="vant/es/space/index.css">\n</style>'
    const source = `<template><view /></template>\n${external}`
    const mutated = injectVueStyleRule(source, '.hmr-audit-marker { color: #0f766e; }')
    const parsed = parseSfc(mutated)
    expect(parsed.errors).toEqual([])
    expect(mutated).toContain(external)
    expect(parsed.descriptor.styles).toHaveLength(2)
    expect(parsed.descriptor.styles[0]?.content.trim()).toBe('')
    const output = compileStyle({ source: parsed.descriptor.styles[1]!.content, filename: 'page.vue', id: 'audit' })
    expect(output.errors).toEqual([])
    expect(output.code).toContain('.hmr-audit-marker')
  })

  it('selects an actual inline style after an external block and ignores closing tags in script strings', () => {
    const source = `<script>const example = '</style>'</script>
<template><view /></template>
<style src="./base.css"></style>
<style scoped>.existing { color: red; }</style>`
    const mutated = injectVueStyleRule(source, '.hmr-audit-marker { color: blue; }')
    const parsed = parseSfc(mutated)
    expect(parsed.errors).toEqual([])
    expect(parsed.descriptor.script?.content).toBe('const example = \'</style>\'')
    expect(parsed.descriptor.styles).toHaveLength(2)
    expect(parsed.descriptor.styles[0]?.content).toBe('')
    expect(parsed.descriptor.styles[1]?.scoped).toBe(true)
    expect(parsed.descriptor.styles[1]?.content).toContain('.hmr-audit-marker')
  })
})
