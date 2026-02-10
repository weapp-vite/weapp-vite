import { describe, expect, it, vi } from 'vitest'
import { compileJsxFile } from './compileJsxFile'

describe('compileJsxFile', () => {
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

    expect(result.template).toContain('wx:for=')
    expect(result.template).toContain('data-wv-inline-id=')
    expect(result.script).toContain('__weapp_vite_inline_map')
    expect(result.script).not.toContain('<view')
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
    expect(result.meta?.jsonMacroHash).toBeTruthy()
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
})
