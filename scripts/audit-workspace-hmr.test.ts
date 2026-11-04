import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parse } from '@babel/parser'
import { getMiniProgramPlatformDescriptor, getSupportedMiniProgramPlatforms } from '@weapp-core/shared'
import { describe, expect, it } from 'vitest'
import { compileStyle, parse as parseSfc } from 'vue/compiler-sfc'
import { discoverWorkspaceHmrProjects, isAuditableScriptEntry } from './audit-workspace-hmr'
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

it('discovers projects without executing any configuration module or factory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workspace-hmr-discovery-'))
  try {
    for (const name of ['selected', 'unselected']) {
      const projectRoot = path.join(root, 'apps', name)
      await mkdir(path.join(projectRoot, 'src'), { recursive: true })
      await writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({ scripts: { dev: 'weapp-vite' } }))
      await writeFile(path.join(projectRoot, 'src/app.json'), '{}')
      await writeFile(path.join(projectRoot, 'vite.config.mjs'), 'throw new Error("discovery must not execute config resources")')
    }
    const projects = await discoverWorkspaceHmrProjects(['apps'], root)
    expect(projects.map(project => project.id)).toEqual(['apps/selected', 'apps/unselected'])
    expect(projects.every(project => !('platform' in project) && !('distRoot' in project))).toBe(true)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

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

  it.each(getSupportedMiniProgramPlatforms())('maps a React view owner to the actual %s template extension', (platform) => {
    const project = { distRoot: path.join('project', 'dist'), sourceRoot: path.join('project', 'src'), platform }
    const source = path.join(project.sourceRoot, 'pages/index/view.tsx')
    const template = getMiniProgramPlatformDescriptor(platform).outputExtensions.wxml
    expect(resolveReactTemplateOutputPath(project, source)).toBe(path.join(project.distRoot, `pages/index/index.${template}`))
  })

  it.each(getSupportedMiniProgramPlatforms())('recognizes a native %s sidecar as an auditable component script', async (platform) => {
    const sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'workspace-hmr-sidecar-'))
    try {
      const script = path.join(sourceRoot, 'components/card/card.ts')
      const template = getMiniProgramPlatformDescriptor(platform).outputExtensions.wxml
      await mkdir(path.dirname(script), { recursive: true })
      await writeFile(script, 'Component({});')
      await writeFile(path.join(path.dirname(script), `card.${template}`), '<view/>')
      expect(isAuditableScriptEntry(sourceRoot, script, platform)).toBe(true)
      expect(isAuditableScriptEntry(sourceRoot, script)).toBe(platform === 'weapp')
    }
    finally {
      await rm(sourceRoot, { recursive: true, force: true })
    }
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
