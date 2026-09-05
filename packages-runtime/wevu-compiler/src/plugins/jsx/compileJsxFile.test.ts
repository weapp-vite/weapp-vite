import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { getMiniProgramTemplatePlatform } from '../vue/compiler/template/platforms'
import { compileJsxFile } from './compileJsxFile'

describe('compileJsxFile', () => {
  it('does not report a missing render option for JSX utility modules', async () => {
    const warnings: string[] = []
    await compileJsxFile(
      'export const shared = <view>shared</view>',
      '/project/src/shared.tsx',
      { warn: message => warnings.push(message) },
    )
    expect(warnings).not.toContainEqual(expect.stringContaining('移除 render 选项'))
  })

  it('keeps JSX-owned callback warnings aligned with structured diagnostics', async () => {
    const warnings: string[] = []
    const result = await compileJsxFile(
      'export default {}',
      '/project/src/pages/jsx-warning/index.tsx',
      { warn: message => warnings.push(message) },
    )

    expect(warnings).toEqual(result.diagnostics?.map(diagnostic => diagnostic.message))
    expect(warnings.length).toBeGreaterThan(1)
  })

  it('includes resolver-cycle warnings in JSX diagnostics', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-warning-cycle-'))
    const entry = path.join(root, 'page.tsx')
    await writeFile(path.join(root, 'a.tsx'), 'export { value } from "./b"')
    await writeFile(path.join(root, 'b.tsx'), 'export { value } from "./a"')
    const warnings: string[] = []
    const result = await compileJsxFile(
      'import { value } from "./a"; export default { render() { return value } }',
      entry,
      { warn: message => warnings.push(message) },
    )

    expect(warnings.some(message => message.includes('循环引用'))).toBe(true)
    expect(warnings).toEqual(result.diagnostics?.map(diagnostic => diagnostic.message))
  })

  it('compiles setup-returned static JSX render closures', async () => {
    const source = `
import { defineComponent } from 'wevu'
export default defineComponent({
  setup() {
    return () => <view><text>setup render</text></view>
  },
})
`
    const result = await compileJsxFile(source, '/project/src/pages/setup/index.tsx', { isPage: true })
    expect(result.template).toBe('<view><text>setup render</text></view>')
    expect(result.script).not.toContain('<view>')
    expect(result.script).not.toContain('createVNode')
  })

  it('returns the typed binding manifest from the direct JSX compiler', async () => {
    const source = `
import { defineComponent, ref } from 'wevu'
export default defineComponent({
  setup() {
    const title = ref('page')
    return () => <view title={title.value}>{title.value}</view>
  },
})
`
    const result = await compileJsxFile(source, '/project/src/pages/manifest/index.tsx')

    expect(result.bindingManifest).toMatchObject({
      version: 1,
      sourceFile: '/project/src/pages/manifest/index.tsx',
    })
    expect(result.bindingManifest?.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'attribute', outputPath: 'title.value' }),
      expect.objectContaining({ kind: 'text', outputPath: 'title.value' }),
    ]))
    expect(result.script).toContain('__wevuBindingManifest')
  })

  it('records JSX bindings with their active loop scope', async () => {
    const source = `
import { defineComponent, ref } from 'wevu'
export default defineComponent({
  setup() {
    const rows = ref([{ title: 'row' }])
    return () => <view>{rows.value.map((row, index) => <text>{row.title + index}</text>)}</view>
  },
})
`
    const result = await compileJsxFile(source, '/project/src/pages/scopes/index.tsx')
    const binding = result.bindingManifest?.bindings.find((item) => {
      return item.kind === 'text' && item.outputPath === 'rows.value'
    })

    expect(binding?.dependencies).toEqual([{
      root: 'rows',
      path: 'rows.value',
      updateMode: 'exact-path',
    }])
    expect(binding?.scopes).toEqual([
      { kind: 'root', depth: 0 },
      { kind: 'for', depth: 1, locals: ['row', 'index'] },
    ])
  })

  it('keeps outer loop dependencies when nested JSX locals shadow their roots', async () => {
    const source = `
import { defineComponent, ref } from 'wevu'
export default defineComponent({
  setup() {
    const items = ref([{ children: [{ name: 'child' }] }])
    return () => (
      <view>
        {items.value.map((rows, rowIndex) => (
          <view>
            {rows.children.map((items, itemIndex) => (
              <text>{items.name + itemIndex + rowIndex}</text>
            ))}
          </view>
        ))}
      </view>
    )
  },
})
`
    const result = await compileJsxFile(source, '/project/src/pages/nested-scopes/index.tsx')
    const binding = result.bindingManifest?.bindings.find((item) => {
      return item.kind === 'text' && item.outputPath === 'items.value'
    })

    expect(binding?.dependencies).toEqual([{
      root: 'items',
      path: 'items.value',
      updateMode: 'exact-path',
    }])
    expect(binding?.scopes).toEqual([
      { kind: 'root', depth: 0 },
      { kind: 'for', depth: 1, locals: ['rows', 'rowIndex'] },
      { kind: 'for', depth: 2, locals: ['items', 'itemIndex'] },
    ])
  })

  it('keeps setup captures required by an extracted JSX template', async () => {
    const source = `
import { defineComponent, ref } from 'wevu'
export default defineComponent({
  setup() {
    const count = ref(1)
    return () => <text>{count.value}</text>
  },
})
`
    const result = await compileJsxFile(source, '/project/src/pages/setup-capture/index.tsx', { isPage: true })
    expect(result.template).toContain('{{count.value}}')
    expect(result.script).toMatch(/return\s*\{\s*count\s*\}/)
    expect(result.script).not.toContain('createVNode')
  })

  it('inlines JSX fragments and factories imported from sibling modules', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-shared-'))
    const shared = path.join(root, 'shared.tsx')
    const entry = path.join(root, 'page.tsx')
    await writeFile(shared, `
      export const sss = <><view>sss</view></>
      export const createPanel = (title: string) => <view className="panel"><text>{title}</text></view>
    `)
    await writeFile(entry, `
      import { sss, createPanel } from './shared'
      import { defineComponent } from 'wevu'
      export default defineComponent({ render() { return <view>{sss}{createPanel('标题')}</view> } })
    `)
    const result = await compileJsxFile(await readFile(entry, 'utf8'), entry)
    expect(result.template).toContain('<view>sss</view>')
    expect(result.template).toContain('<view class="panel"><text>{{\'标题\'}}</text></view>')
    expect(result.meta?.jsxDependencies).toEqual([shared])
  })

  it('keeps cross-file JSX binding ownership on the node that supplied the expression', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-binding-owner-'))
    const shared = path.join(root, 'shared.tsx')
    const entry = path.join(root, 'page.tsx')
    await writeFile(shared, [
      'export const sharedView = <text>{sharedState.label}</text>',
      'export const createPanel = value => <view>{value}</view>',
    ].join('\n'))
    const source = `
      import { sharedView, createPanel } from './shared'
      import { defineComponent } from 'wevu'
      export default defineComponent({
        data() { return { localTitle: 'local', sharedState: { label: 'shared' } } },
        render() { return <view>{sharedView}{createPanel(this.localTitle)}</view> },
      })
    `
    await writeFile(entry, source)

    const result = await compileJsxFile(source, entry, {
      bindingManifestSourceFile: 'src/pages/page.tsx',
      runtimeBindingManifest: 'diagnostic',
    })
    const sharedBinding = result.bindingManifest?.bindings.find(binding => binding.sourceRoots.includes('sharedState'))
    const localBinding = result.bindingManifest?.bindings.find(binding => binding.sourceRoots.includes('localTitle'))

    expect(sharedBinding).toMatchObject({
      sourceFile: 'src/pages/shared.tsx',
      sourceLocation: {
        start: expect.objectContaining({ line: 1 }),
      },
    })
    expect(localBinding?.sourceFile).toBeUndefined()
    expect(result.script).toContain('src/pages/shared.tsx')
  })

  it('resolves JSX fragments through re-export modules', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-reexport-'))
    const shared = path.join(root, 'shared.tsx')
    const barrel = path.join(root, 'barrel.tsx')
    const entry = path.join(root, 'page.tsx')
    await writeFile(shared, 'export const sss = <view>re-exported</view>')
    await writeFile(barrel, 'export { sss } from \'./shared\'')
    await writeFile(entry, `import { sss } from './barrel'
      import { defineComponent } from 'wevu'
      export default defineComponent({ render() { return <view>{sss}</view> } })`)
    const result = await compileJsxFile(await readFile(entry, 'utf8'), entry)
    expect(result.template).toContain('<view>re-exported</view>')
    expect(result.meta?.jsxDependencies).toEqual([barrel, shared])
  })

  it('resolves JSX fragments through namespace imports', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-namespace-'))
    const shared = path.join(root, 'shared.tsx')
    const entry = path.join(root, 'page.tsx')
    await writeFile(shared, 'export const sss = <view>namespace</view>')
    await writeFile(entry, `import * as fragments from './shared'
      import { defineComponent } from 'wevu'
      export default defineComponent({ render() { return <view>{fragments.sss}</view> } })`)
    const result = await compileJsxFile(await readFile(entry, 'utf8'), entry)
    expect(result.template).toContain('<view>namespace</view>')
    expect(result.meta?.jsxDynamicIslands).toEqual([])
  })

  it('statically expands imported JSX factory closures', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-island-'))
    const shared = path.join(root, 'shared.tsx')
    const entry = path.join(root, 'page.tsx')
    await writeFile(shared, 'export const createPanel = (factory: () => any) => factory()')
    await writeFile(entry, `import { createPanel } from './shared'
      import { defineComponent } from 'wevu'
      export default defineComponent({ render() { return <view>{createPanel(() => <text>dynamic</text>)}</view> } })`)
    const result = await compileJsxFile(await readFile(entry, 'utf8'), entry)
    expect(result.template).toContain('<view><text>dynamic</text></view>')
    expect(result.template).not.toContain('data-wv-jsx-island')
    expect(result.script).not.toContain('__wv_jsx_islands')
    expect(result.script).not.toContain('from "vue"')
    expect(result.meta?.jsxDynamicIslands).toEqual([])
  })

  it('records free variables and this in dynamic island capture metadata', async () => {
    const source = `
import { defineComponent } from 'wevu'
const renderDynamic = value => value
export default defineComponent({
  render() {
    return <view>{renderDynamic(this.count)}</view>
  },
})`
    const result = await compileJsxFile(source, '/project/src/pages/capture/index.tsx')
    expect(result.meta?.jsxDynamicIslands?.[0]?.captures).toContain('this')
  })
  const defaultPlatform = getMiniProgramTemplatePlatform()

  it('compiles render JSX to wxml template and script wrapper', async () => {
    const source = `
import { defineComponent } from 'wevu'

export default defineComponent({
  methods: {
    tap() {},
  },
  render() {
    return <view className="box" onTap={this.tap}>hello</view>
  },
})
`

    const result = await compileJsxFile(source, '/project/src/pages/index/index.tsx', {
      isPage: true,
    })

    expect(result.template).toContain('<view')
    expect(result.template).toContain('class="box"')
    expect(result.template).toContain('bindtap="tap"')
    expect(result.script).toContain('createWevuComponent')
    expect(result.script).not.toContain('<view')
  })

  it('leaves JSX component registration to the logical entry when requested', async () => {
    const source = `
import { defineComponent } from 'wevu'

export default defineComponent({
  render() {
    return <view>logical entry component</view>
  },
})
`

    const result = await compileJsxFile(source, '/project/src/components/card.tsx', {
      skipComponentTransform: true,
    })

    expect(result.script).toContain('export default')
    expect(result.script).not.toContain('createWevuComponent')
  })

  it('skips json macro metadata when tsx source has no json macro call', async () => {
    const source = `
import { defineComponent } from 'wevu'

const definePageJsonValue = 'not a macro'

export default defineComponent({
  render() {
    return <view>{definePageJsonValue}</view>
  },
})
`

    const result = await compileJsxFile(source, '/project/src/pages/no-json-macro/index.tsx', {
      isPage: true,
    })

    expect(result.template).toContain('<view')
    expect(result.meta?.jsonMacroHash).toBeUndefined()
    expect(result.script).toContain('definePageJsonValue')
  })

  it('supports class attribute in tsx render', async () => {
    const source = `
import { defineComponent } from 'vue'

export default defineComponent({
  render() {
    return <view class="panel"><text class="title">ok</text></view>
  },
})
`

    const result = await compileJsxFile(source, '/project/src/pages/class/index.tsx', {
      isPage: true,
    })

    expect(result.template).toContain('class="panel"')
    expect(result.template).toContain('class="title"')
  })

  it('compiles map and inline handlers', async () => {
    const source = `
import { defineComponent } from 'wevu'

export default defineComponent({
  data() {
    return {
      list: [1, 2, 3],
    }
  },
  methods: {
    click(v) {
      return v
    },
  },
  render() {
    return <view>{this.list.map((item, index) => <view key={index} onTap={() => this.click(item)}>{item}</view>)}</view>
  },
})
`

    const result = await compileJsxFile(source, '/project/src/pages/list/index.tsx', {
      isPage: true,
    })

    expect(result.template).toContain(`${defaultPlatform.directives.forAttr}=`)
    expect(result.template).toContain('data-wi-tap=')
    expect(result.script).toContain('__weapp_vite_inline_map')
    expect(result.script).not.toContain('<view')
  })

  it('renders spaced mustache when interpolation mode is spaced', async () => {
    const source = `
import { defineComponent } from 'wevu'

export default defineComponent({
  data() {
    return {
      ok: true,
      list: [1],
    }
  },
  render() {
    return <view hidden={this.ok}>{this.list.map((item, index) => <text key={index}>{item}</text>)}</view>
  },
})
`

    const result = await compileJsxFile(source, '/project/src/pages/jsx/mustache.tsx', {
      isPage: true,
      template: {
        mustacheInterpolation: 'spaced',
      },
    })

    expect(result.template).toContain('hidden="{{ ok }}"')
    expect(result.template).toContain(`${defaultPlatform.directives.forAttr}="{{ list }}"`)
    expect(result.template).toContain('{{ item }}')
  })

  it.each([
    ['alipay', 'a:for', 'a:key'],
    ['tt', 'tt:for', 'tt:key'],
  ])('renders %s structural directives for tsx templates', async (platform, forAttr, keyAttr) => {
    const source = `
import { defineComponent } from 'wevu'

export default defineComponent({
  data() {
    return {
      list: [1, 2],
    }
  },
  render() {
    return <view>{this.list.map((item, index) => <text key={index}>{item}</text>)}</view>
  },
})
`

    const result = await compileJsxFile(source, `/project/src/pages/${platform}/index.tsx`, {
      isPage: true,
      template: {
        platform: getMiniProgramTemplatePlatform(platform as any),
      },
    })

    expect(result.template).toContain(`${forAttr}="{{list}}"`)
    expect(result.template).toContain(`${keyAttr}="index"`)
  })

  it('extracts json macro config from tsx source', async () => {
    const source = `
import { defineComponent } from 'wevu'
import { definePageJson } from 'weapp-vite'

definePageJson({
  navigationBarTitleText: 'JSX 页面',
})

export default defineComponent({
  render() {
    return <view>json</view>
  },
})
`

    const result = await compileJsxFile(source, '/project/src/pages/jsx/index.tsx', {
      isPage: true,
      json: {
        defaults: {
          page: {
            enablePullDownRefresh: true,
          },
        },
      },
    })

    expect(result.config).toBeTruthy()
    const parsed = JSON.parse(result.config!)
    expect(parsed.navigationBarTitleText).toBe('JSX 页面')
    expect(parsed.enablePullDownRefresh).toBe(true)
    expect(result.script).not.toContain('definePageJson(')
    expect(result.script).not.toMatch(/from\s*['"]weapp-vite['"]/)
    expect(result.script).toContain('virtual:weapp-vite/runtime')
    expect(result.meta?.jsonMacroHash).toBeTruthy()
  })

  it('does not inject invalid page share config keys from wevu share hooks', async () => {
    const source = `
import { defineComponent, onShareAppMessage, onShareTimeline } from 'wevu'
import { definePageJson } from 'weapp-vite'

definePageJson({
  navigationBarTitleText: 'JSX 分享页',
})

export default defineComponent({
  setup() {
    onShareAppMessage(() => ({ title: 'share' }))
    onShareTimeline(() => ({ title: 'timeline' }))
  },
  render() {
    return <view>share</view>
  },
})
`

    const result = await compileJsxFile(source, '/project/src/pages/jsx/share.tsx', {
      isPage: true,
    })

    expect(result.config).toBeTruthy()
    const parsed = JSON.parse(result.config!)
    expect(parsed.navigationBarTitleText).toBe('JSX 分享页')
    expect(parsed.enableShareAppMessage).toBeUndefined()
    expect(parsed.enableShareTimeline).toBeUndefined()
  })

  it('infers usingComponents from jsx imports and template tags', async () => {
    const resolveUsingComponentPath = vi.fn(async (_importSource: string, _filename: string, info?: { localName: string }) => {
      if (info?.localName === 'TButton') {
        return 'tdesign-miniprogram/button/button'
      }
      return undefined
    })

    const resolveUsingComponent = vi.fn(async (tag: string) => {
      if (tag === 't-cell-group') {
        return {
          name: tag,
          from: 'tdesign-miniprogram/cell-group/cell-group',
        }
      }
      return undefined
    })

    const source = `
import { defineComponent } from 'wevu'
import TButton from '@/components/TButton'

export default defineComponent({
  render() {
    return <view><TButton /><t-cell-group /></view>
  },
})
`

    const result = await compileJsxFile(source, '/project/src/pages/jsx/auto.tsx', {
      isPage: true,
      autoUsingComponents: {
        resolveUsingComponentPath,
      },
      autoImportTags: {
        resolveUsingComponent,
      },
    })

    expect(result.config).toBeTruthy()
    expect(JSON.parse(result.config!)).toEqual({
      usingComponents: {
        't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
        'TButton': 'tdesign-miniprogram/button/button',
      },
    })
    expect(resolveUsingComponentPath).toHaveBeenCalledWith(
      '@/components/TButton',
      '/project/src/pages/jsx/auto.tsx',
      expect.objectContaining({
        localName: 'TButton',
        importedName: 'default',
        kind: 'default',
      }),
    )
    expect(resolveUsingComponent).toHaveBeenCalledWith('t-cell-group', '/project/src/pages/jsx/auto.tsx')
  })

  it('prefers autoUsingComponents when resolver conflicts', async () => {
    const autoUsingWarn = vi.fn()

    const source = `
import { defineComponent } from 'wevu'
import TButton from '@/components/TButton'

export default defineComponent({
  render() {
    return <TButton />
  },
})
`

    const result = await compileJsxFile(source, '/project/src/pages/jsx/conflict.tsx', {
      autoUsingComponents: {
        resolveUsingComponentPath: async () => 'tdesign-miniprogram/button/button-from-import',
        warn: autoUsingWarn,
      },
      autoImportTags: {
        resolveUsingComponent: async (tag: string) => {
          if (tag === 'TButton') {
            return {
              name: tag,
              from: 'tdesign-miniprogram/button/button-from-tag',
            }
          }
          return undefined
        },
      },
    })

    expect(result.config).toBeTruthy()
    expect(JSON.parse(result.config!).usingComponents.TButton).toBe('tdesign-miniprogram/button/button-from-import')
    expect(autoUsingWarn).toHaveBeenCalledTimes(1)
  })

  it('supports oxc auto-component analysis through compileJsxFile options', async () => {
    const resolveUsingComponentPath = vi.fn(async (_importSource: string, _filename: string, info?: { localName: string }) => {
      if (info?.localName === 'TButton') {
        return 'tdesign-miniprogram/button/button'
      }
      return undefined
    })

    const source = `
import { defineComponent as defineWevuComponent } from 'wevu'
import TButton from '@/components/TButton'

const page = defineWevuComponent({
  render() {
    return <view><TButton /></view>
  },
})

export default page
`

    const result = await compileJsxFile(source, '/project/src/pages/jsx/oxc-auto.tsx', {
      astEngine: 'oxc',
      autoUsingComponents: {
        resolveUsingComponentPath,
      },
    })

    expect(result.config).toBeTruthy()
    expect(JSON.parse(result.config!)).toEqual({
      usingComponents: {
        TButton: 'tdesign-miniprogram/button/button',
      },
    })
    expect(resolveUsingComponentPath).toHaveBeenCalledWith(
      '@/components/TButton',
      '/project/src/pages/jsx/oxc-auto.tsx',
      expect.objectContaining({
        localName: 'TButton',
        importedName: 'default',
        kind: 'default',
      }),
    )
  })
})
