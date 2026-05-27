import { describe, expect, it } from 'vitest'
import { buildClassStyleComputedCode } from '../transform/classStyleComputed'
import { compileVueTemplateToWxml, getMiniProgramTemplatePlatform } from './template'

const WHITESPACE_RE = /\s/g
const INLINE_OBJECT_PROP_RE = /prop="\{\{\s*\{[^}]+\}\s*\}\}"/
const DATA_TITLE_BIND_RE = /data-title="\{\{__wv_bind_\d+\}\}"/
const INTERPOLATION_BIND_INDEX_RE = /\{\{__wv_bind_\d+\[[^\]]+\]\}\}/
const DEFAULT_TEMPLATE_PLATFORM = getMiniProgramTemplatePlatform()
const DEFAULT_DIRECTIVES = DEFAULT_TEMPLATE_PLATFORM.directives
const IF_BIND_RE = new RegExp(`${DEFAULT_TEMPLATE_PLATFORM.directives.ifAttr}="\\{\\{__wv_bind_\\d+\\}\\}"`)
const FOR_BIND_RE = new RegExp(`${DEFAULT_TEMPLATE_PLATFORM.directives.forAttr}="\\{\\{__wv_bind_\\d+\\}\\}"`)

function expectNativeThirdPartySlotOutput(
  template: string,
  expected: string[],
  options?: Parameters<typeof compileVueTemplateToWxml>[2],
) {
  const { code, scopedSlotComponents } = compileVueTemplateToWxml(
    template.trim(),
    '/project/src/pages/third-party-native-slots/index.vue',
    {
      scopedSlotsRequireProps: false,
      ...options,
    },
  )
  const normalizedCode = code.replace(WHITESPACE_RE, '')

  for (const item of expected) {
    expect(normalizedCode).toContain(item.replace(WHITESPACE_RE, ''))
  }
  expect(code).not.toContain('generic:scoped-slots-')
  expect(scopedSlotComponents).toBeUndefined()
}

function buildComputedCode(bindings: NonNullable<ReturnType<typeof compileVueTemplateToWxml>['classStyleBindings']>) {
  return buildClassStyleComputedCode(bindings, {
    normalizeClassName: '__wevuNormalizeClass',
    normalizeStyleName: '__wevuNormalizeStyle',
    unrefName: '__wevuUnref',
  })
}

function expectScopedSlotComputed(
  bindings: NonNullable<ReturnType<typeof compileVueTemplateToWxml>['classStyleBindings']> | undefined,
  expectedExp: string,
  expectedFragments: string[],
) {
  expect(bindings?.some(binding => binding.exp === expectedExp)).toBe(true)
  const computedCode = buildComputedCode(bindings ?? [])
  expect(computedCode).toBeTruthy()
  for (const fragment of expectedFragments) {
    expect(computedCode).toContain(fragment)
  }
  expect(computedCode).not.toContain('this.__wvOwner.func')
}

describe('compileVueTemplateToWxml', () => {
  it('rewrites nullish coalescing in bindings', () => {
    const template = `
<t-icon :name="item.icon ?? 'app'" />
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/components/QuickActionGrid/index.vue')

    const normalized = code.replace(WHITESPACE_RE, '')
    expect(normalized).toContain(`name="{{item.icon!=null?item.icon:'app'}}"`)
    expect(code).not.toContain('??')
  })

  it('rewrites optional chaining in template expressions', () => {
    const template = `
<view :title="routeMeta?.title || '首页'">{{ routeMeta?.group || '模块' }}</view>
<view v-if="scene?.kpis">{{ scene?.summary }}</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/components/RetailPageShell/index.vue')
    const normalized = code.replace(WHITESPACE_RE, '')

    expect(normalized).not.toContain('?.')
    expect(normalized).toContain(`routeMeta==null?undefined:routeMeta.title`)
    expect(normalized).toContain(`routeMeta==null?undefined:routeMeta.group`)
    expect(normalized).toContain(`scene==null?undefined:scene.kpis`)
    expect(normalized).toContain(`scene==null?undefined:scene.summary`)
  })

  it('formats generated wxml when enabled without touching default compact output', () => {
    const template = `
<view class="page">
  <view>
    <view />
  </view>
</view>
    `.trim()

    const compact = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')
    const formatted = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue', {
      formatWxml: true,
    })

    expect(compact.code).toBe('<view class="page"><view><view /></view></view>')
    expect(formatted.code).toBe([
      '<view class="page">',
      '  <view>',
      '    <view />',
      '  </view>',
      '</view>',
      '',
    ].join('\n'))
  })

  it('keeps text-bearing elements inline during wxml formatting', () => {
    const template = `
<view>
  <text>Hello {{ name }}</text>
  <view><text>Nested</text></view>
</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue', {
      formatWxml: true,
    })

    expect(code).toContain('  <text>Hello {{name}}</text>\n')
    expect(code).toContain('  <view>\n    <text>Nested</text>\n  </view>\n')
  })

  it('keeps greater-than markers inside attribute values during wxml formatting', () => {
    const template = `
<view>
  <VueCard
    :title="\`页面 -> Vue（\${mode}）\`"
    subtitle="页面 -> Vue 静态链路"
  />
</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/component-interop/index.vue', {
      formatWxml: true,
    })

    expect(code).toContain('title="{{\'页面 -> Vue（\'+mode+\'）\'}}"')
    expect(code).toContain('subtitle="页面 -> Vue 静态链路"')
    expect(code).not.toContain('页面 ->\n')
  })

  it('collects component prop binding paths for auto function prop snapshots', () => {
    const template = `
<view :callback="callback" />
<Child
  :callback="callback"
  :title="title"
  :subtitle="meta.title"
  :on-save="handlers.save"
  :class="classes"
  :ref="childRef"
  :key="id"
  :dynamic="callbacks[id]"
  :handler="callbacks[id]"
  :selected="data.userId"
  @tap="callback"
/>
<van-cell :change="handlers.change" />
    `.trim()

    const result = compileVueTemplateToWxml(
      template,
      '/project/src/components/FunctionProps/index.vue',
      { functionPropNames: [/^(?:handler|on-.+)$/], wevuComponentTags: ['van-cell'] },
    )

    expect(result.code).toContain('subtitle="{{meta.title}}"')
    expect(result.code).toContain('on-save="{{__wv_bind_0}}"')
    expect(result.code).toContain('dynamic="{{callbacks[id]}}"')
    expect(result.code).toContain('handler="{{__wv_bind_1}}"')
    expect(result.code).toContain('selected="{{data.userId}}"')
    expect(result.code).toContain('change="{{handlers.change}}"')
    expect(result.functionPropPaths).toEqual(['callback', 'title', 'meta.title', '__wv_bind_0', '__wv_bind_1', 'data.userId', 'handlers.change'])
    expect(result.classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.exp === 'handlers.save')).toBe(true)
    expect(result.classStyleBindings?.some(binding => binding.name === '__wv_bind_1' && binding.exp === 'callbacks[id]')).toBe(true)
    expect(result.classStyleBindings?.some(binding => binding.exp === 'handlers.change')).toBe(false)
    expect(result.classStyleBindings?.some(binding => binding.exp === 'callbacks[id]' && binding.name !== '__wv_bind_1')).toBe(false)
  })

  it('does not infer runtime function prop bindings from event-like prop names', () => {
    const template = `
<Child
  :on-save="handlers.save"
  :change="handlers.change"
  :handler="callbacks[id]"
/>
    `.trim()

    const result = compileVueTemplateToWxml(
      template,
      '/project/src/components/FunctionProps/index.vue',
    )

    expect(result.code).toContain('on-save="{{handlers.save}}"')
    expect(result.code).toContain('change="{{handlers.change}}"')
    expect(result.code).toContain('handler="{{callbacks[id]}}"')
    expect(result.code).not.toContain('__wv_bind_')
    expect(result.functionPropPaths).toEqual(['handlers.save', 'handlers.change'])
    expect(result.classStyleBindings).toBeUndefined()
  })

  it('wraps object literal in v-bind attribute expression', () => {
    const template = `
<InfoBanner :root="{ a: 'aaaa' }" />
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    const normalized = code.replace(WHITESPACE_RE, '')
    expect(normalized).toContain(`root="{{__wv_bind_0}}"`)
    expect(code).not.toContain('root="{{{')
    expect(classStyleBindings).toBeDefined()
    expect(classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.type === 'bind')).toBe(true)
  })

  it('prefers props named data in generated style computed bindings', () => {
    const template = `
<view :style="{ color: data.color, fontSize: data.size + 'rpx' }" />
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/components/DataProp/index.vue')
    const computedCode = buildComputedCode(classStyleBindings ?? [])

    expect(code).toContain('style="{{__wv_style_0}}"')
    expect(computedCode).toContain('__wevuResolvePropValue(this,"data",this.data)')
    expect(computedCode).not.toContain('this.$state')
  })

  it('rewrites defineProps destructure aliases in template expressions', () => {
    const template = `
<view :class="{ [y]: y }" :data-value="y">{{ y }}</view>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-600/index.vue',
      {
        propsAliases: {
          y: 'x',
        },
      },
    )
    const computedCode = buildComputedCode(classStyleBindings ?? [])

    expect(code).toContain('data-value="{{y}}"')
    expect(code).toContain('{{y}}')
    expect(code).not.toContain('{{x}}')
    expect(computedCode).toContain('__wevuResolvePropValue(this,"x",this.y,true)')
    expect(computedCode).not.toContain('__wevuResolvePropValue(this,"y",this.y)')
  })

  it('keeps props aliases separate from same-name setup bindings', () => {
    const template = `
<view :class="{ [y]: y }" :data-alias="y">{{ y }}</view>
<view :class="{ [x]: x }" :data-setup="x">{{ x }}</view>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-600/index.vue',
      {
        propsAliases: {
          y: 'x',
        },
      },
    )
    const computedCode = buildComputedCode(classStyleBindings ?? [])

    expect(code).toContain('data-alias="{{y}}"')
    expect(code).toContain('data-setup="{{x}}"')
    expect(code).toContain('{{y}}')
    expect(code).toContain('{{x}}')
    expect(computedCode).toContain('__wevuResolvePropValue(this,"x",this.y,true)')
    expect(computedCode).toContain('__wevuResolvePropValue(this,"x",this.x)')
    expect(computedCode).not.toContain('__wevuResolvePropValue(this,"y",this.y)')
  })

  it('uses compact runtime props helper for complex class/style/v-show aliases', () => {
    const template = `
<view
  class="issue600-complex"
  :class="[y && (y + '-alias'), { [x]: x && y, visible: visible && y !== 'hidden' }, y ? ['nested', { ready: x === 'issue-600-setup' }] : []]"
  :style="[{ color: theme.color }, y ? { fontSize: size + 'rpx' } : null]"
  v-show="visible && y !== 'hidden'"
  :data-alias="y"
>
  {{ y }}
</view>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-600/index.vue',
      {
        propsAliases: {
          y: 'x',
        },
      },
    )
    const computedCode = buildComputedCode(classStyleBindings ?? [])

    expect(code).toContain('class="{{__wv_cls_0}}"')
    expect(code).toContain('style="{{__wv_style_0}}"')
    expect(code).toContain('data-alias="{{y}}"')
    expect(computedCode).toContain('issue600-complex')
    expect(computedCode).toContain('__wevuResolvePropValue(this,"x",this.y,true)')
    expect(computedCode).toContain('__wevuResolvePropValue(this,"x",this.x)')
    expect(computedCode).toContain('__wevuResolvePropValue(this,"visible",this.visible)')
    expect(computedCode).toContain('__wevuResolvePropValue(this,"theme",this.theme)')
    expect(computedCode).toContain('__wevuResolvePropValue(this,"size",this.size)')
    expect(computedCode).toContain('__wevuResolvePropValue(this,"x",this.y,true)')
    expect(computedCode).not.toContain('__wevuResolvePropValue(this,"y",this.y)')
  })

  it('inlines object literal in v-bind attribute expression when enabled', () => {
    const template = `
<icon :prop="{ active: props.event.isMyFavorite }" />
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { objectLiteralBindMode: 'inline' },
    )

    expect(code).toMatch(INLINE_OBJECT_PROP_RE)
    expect(code).not.toContain('prop="{{{')
    expect(classStyleBindings).toBeUndefined()
  })

  it('supports wxs change listeners via v-bind argument with namespace', () => {
    const template = `
<wxs module="swipe">
  module.exports = {}
</wxs>
<view
  :closed="closed"
  :leftWidth="leftWidth"
  :change:closed="swipe.onCloseChange"
  :change:leftWidth="swipe.initLeftWidth"
/>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/components/swipeout/index.vue',
    )

    expect(code).toContain('closed="{{closed}}"')
    expect(code).toContain('leftWidth="{{leftWidth}}"')
    expect(code).toContain('change:closed="{{swipe.onCloseChange}}"')
    expect(code).toContain('change:leftWidth="{{swipe.initLeftWidth}}"')
  })

  it('supports Vue 3.4 v-bind shorthand for static props', () => {
    const template = `
<view :visible :foo-bar />
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
    )

    expect(code).toContain('visible="{{visible}}"')
    expect(code).toContain('foo-bar="{{fooBar}}"')
  })

  it('supports Vue 3.4 v-bind shorthand for dynamic component is', () => {
    const template = `
<component :is />
    `.trim()

    const { code, warnings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
    )

    expect(code).toContain('<component data-is="{{is}}"></component>')
    expect(warnings).not.toContain('<component> 未提供 :is 绑定，将按普通元素处理。')
  })

  it('renders mustache with spaces when interpolation mode is spaced', () => {
    const template = `
<view v-if="ok" :prop="value" :class="dynamicClass" v-show="visible">{{ text }}</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { mustacheInterpolation: 'spaced' },
    )

    expect(code).toContain(`${DEFAULT_DIRECTIVES.ifAttr}="{{ ok }}"`)
    expect(code).toContain('prop="{{ value }}"')
    expect(code).toContain('class="{{ __wv_cls_0 }}"')
    expect(code).toContain('style="{{ __wv_style_0 }}"')
    expect(code).toContain('{{ text }}')
  })

  it('decodes html entities without falling back template source', () => {
    const template = `
<view v-if="ok" title="a &amp; b">{{ label }} &amp; more</view>
    `.trim()

    const { code, warnings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { mustacheInterpolation: 'spaced' },
    )

    expect(code).toContain(`${DEFAULT_DIRECTIVES.ifAttr}="{{ ok }}"`)
    expect(code).toContain('title="a & b"')
    expect(code).toContain('{{ label }}')
    expect(code).not.toContain('v-if="ok"')
    expect(warnings).not.toContainEqual(expect.stringContaining('decodeEntities'))
  })

  it('maps common html tags to builtin wxml tags in vue templates', () => {
    const template = `
<div class="card" @tap="onTap">
  <span>{{ title }}</span>
  <img :src="cover" />
  <a url="/pages/detail/index">详情</a>
</div>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('<view class="div card" bindtap="onTap">')
    expect(code).toContain('<text class="span">{{title}}</text>')
    expect(code).toContain('<image class="img" src="{{cover}}" />')
    expect(code).toContain('<navigator class="a" url="/pages/detail/index">详情</navigator>')
    expect(code).not.toContain('data-wd-tap')
    expect(code).not.toContain('<div')
    expect(code).not.toContain('<span')
    expect(code).not.toContain('<img')
    expect(code).not.toContain('<a ')
  })

  it('supports overriding html tag mapping per compile option', () => {
    const template = `
<section><span>hello</span></section>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue', {
      htmlTagToWxml: {
        section: 'scroll-view',
        span: 'view',
      },
    })

    expect(code).toContain('<scroll-view class="section"><view class="span">hello</view></scroll-view>')
  })

  it('allows disabling html tag mapping explicitly', () => {
    const template = `
<div><span>hello</span></div>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue', {
      htmlTagToWxml: false,
    })

    expect(code).toContain('<div><span>hello</span></div>')
    expect(code).not.toContain('<view><text>hello</text></view>')
  })

  it('keeps PascalCase and kebab-case component tags untouched when html mapping is enabled', () => {
    const template = `
<div>
  <HelloCard />
  <hello-card />
</div>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('<view class="div">')
    expect(code).toContain('<HelloCard />')
    expect(code).toContain('<hello-card />')
    expect(code).not.toContain('<textCard')
  })

  it('treats mapped html tags as builtin elements rather than component nodes', () => {
    const template = `
<span @tap="onTap">text</span>
<div layout-host="dialog-host" />
    `.trim()

    const { code, warnings, layoutHosts } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('<text class="span" bindtap="onTap">text</text>')
    expect(code).not.toContain('data-wd-tap')
    expect(layoutHosts).toBeUndefined()
    expect(warnings).toContain('layout-host 仅支持声明在组件节点上，当前节点已忽略。')
  })

  it('applies html tag mapping inside structural directives', () => {
    const template = `
<div v-if="ok">
  <span v-for="item in list" :key="item">{{ item }}</span>
</div>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`<block ${DEFAULT_DIRECTIVES.ifAttr}="{{ok}}"><view class="div">`)
    expect(code).toContain(`<text class="span" ${DEFAULT_DIRECTIVES.forAttr}="{{list}}" ${DEFAULT_DIRECTIVES.forItemAttr}="item"`)
    expect(code).toContain('{{item}}</text>')
    expect(code).not.toContain('<div ')
    expect(code).not.toContain('<span ')
  })

  it('merges partial html tag overrides with the default mapping table', () => {
    const template = `
<div><span>hello</span><img src="/cover.png" /></div>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue', {
      htmlTagToWxml: {
        span: 'view',
      },
    })

    expect(code).toContain('<view class="div"><view class="span">hello</view><image class="img" src="/cover.png" /></view>')
  })

  it('merges mapped tag class with existing static and dynamic class bindings by default', () => {
    const template = `
<h3 class="title" :class="titleClass">标题</h3>
<br />
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
    )

    expect(code).toContain('class="{{__wv_cls_0}}"')
    expect(code).toContain('<view class="br" />')
    const classBinding = classStyleBindings?.find(binding => binding.name === '__wv_cls_0')
    expect(classBinding?.exp).toContain('h3 title')
    expect(classBinding?.exp).toContain('titleClass')
  })

  it('allows disabling mapped tag class injection explicitly', () => {
    const template = `
<h3 class="title" :class="titleClass">标题</h3>
<br />
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { htmlTagToWxmlTagClass: false },
    )

    expect(code).toContain('class="{{__wv_cls_0}}"')
    expect(code).not.toContain('class="br"')
    const classBinding = classStyleBindings?.find(binding => binding.name === '__wv_cls_0')
    expect(classBinding?.exp).toContain('title')
    expect(classBinding?.exp).toContain('titleClass')
    expect(classBinding?.exp).not.toContain('h3 title')
  })

  it('falls back interpolation call expression to runtime binding', () => {
    const template = `
<text>{{ sayHello() }}</text>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('{{__wv_bind_0}}')
    expect(code).not.toContain('sayHello()')
    expect(classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.exp === 'sayHello()')).toBe(true)
  })

  it('falls back v-bind and v-text call expressions to runtime bindings', () => {
    const template = `
<view :title="sayHello()" v-text="sayHello()" />
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')
    const normalized = code.replace(WHITESPACE_RE, '')

    expect(normalized).toContain('title="{{__wv_bind_0}}"')
    expect(normalized).toContain('>{{__wv_bind_1}}</view>')
    expect(classStyleBindings?.filter(binding => binding.exp === 'sayHello()')).toHaveLength(2)
  })

  it('collects static layout-host metadata for component nodes', () => {
    const template = `
<t-toast layout-host="layout-toast" />
<t-dialog class="fixed-host" layout-host="layout-dialog" />
    `.trim()

    const { code, layoutHosts, templateRefs } = compileVueTemplateToWxml(
      template,
      '/project/src/layouts/default.vue',
    )

    expect(code).toContain('id="__wv-layout-host-0"')
    expect(code).toContain('id="__wv-layout-host-1"')
    expect(layoutHosts).toEqual([
      {
        key: 'layout-toast',
        refName: '__wevu_layout_host_0',
        selector: '#__wv-layout-host-0',
        kind: 'component',
      },
      {
        key: 'layout-dialog',
        refName: '__wevu_layout_host_1',
        selector: '#__wv-layout-host-1',
        kind: 'component',
      },
    ])
    expect(templateRefs).toEqual([
      {
        selector: '#__wv-layout-host-0',
        inFor: false,
        name: '__wevu_layout_host_0',
        kind: 'component',
      },
      {
        selector: '#__wv-layout-host-1',
        inFor: false,
        name: '__wevu_layout_host_1',
        kind: 'component',
      },
    ])
  })

  it('falls back structural call expressions to runtime bindings', () => {
    const template = `
<view v-if="isVisible()">A</view>
<view v-for="item in getItems()" :key="item.id">{{ item }}</view>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`${DEFAULT_DIRECTIVES.ifAttr}="{{__wv_bind_0}}"`)
    expect(code).toContain(`${DEFAULT_DIRECTIVES.forAttr}="{{__wv_bind_1}}"`)
    expect(classStyleBindings?.some(binding => binding.exp === 'isVisible()')).toBe(true)
    expect(classStyleBindings?.some(binding => binding.exp === 'getItems()')).toBe(true)
  })

  it('falls back complex multi-arg call expressions across bind/if/for/interpolation', () => {
    const template = `
<view :data-title="sayHello(1, 'root', dasd)" />
<view v-if="shouldRenderList()">
  <view v-for="item in getRows()" :key="item.id">
    <text>{{ sayHello(1, item.label, dasd) }}</text>
  </view>
</view>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toMatch(DATA_TITLE_BIND_RE)
    expect(code).toMatch(IF_BIND_RE)
    expect(code).toMatch(FOR_BIND_RE)
    expect(code).toMatch(INTERPOLATION_BIND_INDEX_RE)
    expect(code).not.toContain('sayHello(1, item.label, dasd)')
    expect(classStyleBindings?.some(binding => binding.exp === `sayHello(1, 'root', dasd)`)).toBe(true)
    expect(classStyleBindings?.some(binding => binding.exp === 'shouldRenderList()')).toBe(true)
    expect(classStyleBindings?.some(binding => binding.exp === 'getRows()')).toBe(true)
    expect(classStyleBindings?.some(binding => binding.exp === 'sayHello(1, item.label, dasd)')).toBe(true)
  })

  it('supports v-for tuple destructuring aliases in template expressions', () => {
    const template = `
<view v-for="([key, value], index) in entries" :key="index">
  {{ index + 1 }}. {{ key }} = {{ value }}
</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`${DEFAULT_DIRECTIVES.forAttr}="{{entries}}"`)
    expect(code).toContain(`${DEFAULT_DIRECTIVES.forItemAttr}="__wv_item_0"`)
    expect(code).toContain(`${DEFAULT_DIRECTIVES.forIndexAttr}="index"`)
    expect(code).toContain(DEFAULT_TEMPLATE_PLATFORM.keyAttr('index'))
    expect(code).toContain('{{__wv_item_0[0]}}')
    expect(code).toContain('{{__wv_item_0[1]}}')
    expect(code).not.toContain('{{key}}')
    expect(code).not.toContain('{{value}}')
  })

  it('supports v-for tuple destructuring aliases in inline events', () => {
    const template = `
<view v-for="([key, value], index) in entries" :key="index" @tap="onTap(key, value, index)">
  {{ key }}
</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('bindtap="__weapp_vite_inline"')
    expect(code).toContain('data-wv-s0="{{__wv_item_0[0]}}"')
    expect(code).toContain('data-wv-s1="{{__wv_item_0[1]}}"')
    expect(code).toContain('data-wv-s2="{{index}}"')
  })

  it('supports v-for object-pattern destructuring aliases in template expressions', () => {
    const template = `
<view v-for="({ key, value }, index) in rows" :key="index">
  {{ index + 1 }}. {{ key }} = {{ value }}
</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`${DEFAULT_DIRECTIVES.forAttr}="{{rows}}"`)
    expect(code).toContain(`${DEFAULT_DIRECTIVES.forItemAttr}="__wv_item_0"`)
    expect(code).toContain(`${DEFAULT_DIRECTIVES.forIndexAttr}="index"`)
    expect(code).toContain('{{__wv_item_0.key}}')
    expect(code).toContain('{{__wv_item_0.value}}')
    expect(code).not.toContain('{{ key }}')
    expect(code).not.toContain('{{ value }}')
  })

  it('supports v-for over object map with key alias', () => {
    const template = `
<view v-for="(value, key) in summaryMap" :key="key">
  {{ key }} = {{ value }}
</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`${DEFAULT_DIRECTIVES.forAttr}="{{summaryMap}}"`)
    expect(code).toContain(`${DEFAULT_DIRECTIVES.forItemAttr}="value"`)
    expect(code).toContain(`${DEFAULT_DIRECTIVES.forIndexAttr}="key"`)
    expect(code).toContain(DEFAULT_TEMPLATE_PLATFORM.keyAttr('key'))
    expect(code).toContain('{{key}} = {{value}}')
  })

  it('rewrites component simple event handlers to inline payload handlers', () => {
    const template = `
<CompatAltPanel @run="onPanelRun" />
    `.trim()

    const { code, inlineExpressions } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('bindrun="__weapp_vite_inline"')
    expect(code).toContain('data-wd-run="1"')
    expect(code).toContain('data-wi-run="i0"')
    expect(code).not.toContain('bindrun="onPanelRun"')
    expect(inlineExpressions?.[0]?.expression).toContain('ctx.onPanelRun($event)')
  })

  it('preserves component click as a custom event while native nodes map click to tap', () => {
    const template = `
<view @click="onNativeClick" />
<CompatAltPanel @click="onPanelClick" @tap="onPanelTap" />
    `.trim()

    const { code, inlineExpressions } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('<view bindtap="onNativeClick" />')
    expect(code).toContain('bindclick="__weapp_vite_inline"')
    expect(code).toContain('bindtap="__weapp_vite_inline"')
    expect(code).toContain('data-wd-click="1"')
    expect(code).toContain('data-wd-tap="1"')
    expect(inlineExpressions?.[0]?.expression).toContain('ctx.onPanelClick($event)')
    expect(inlineExpressions?.[1]?.expression).toContain('ctx.onPanelTap($event)')
  })

  it('marks component inline events to use detail payload semantics', () => {
    const template = `
<CompatAltPanel @run="onPanelRun($event)" />
    `.trim()

    const { code, inlineExpressions } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('bindrun="__weapp_vite_inline"')
    expect(code).toContain('data-wd-run="1"')
    expect(code).toContain('data-wi-run="i0"')
    expect(inlineExpressions?.[0]?.expression).toContain('ctx.onPanelRun($event)')
  })

  it('emits event-scoped inline attrs for multiple component listeners', () => {
    const template = `
<CompatAltPanel @run="onPanelRun" @runevent="onPanelRunEvent($event)" />
    `.trim()

    const { code, inlineExpressions } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('bindrun="__weapp_vite_inline"')
    expect(code).toContain('bindrunevent="__weapp_vite_inline"')
    expect(code).toContain('data-wi-run="i0"')
    expect(code).toContain('data-wi-runevent="i1"')
    expect(code).toContain('data-wd-run="1"')
    expect(code).toContain('data-wd-runevent="1"')
    expect(code).not.toContain('data-wv-inline-id="')
    expect(inlineExpressions?.[0]?.expression).toContain('ctx.onPanelRun($event)')
    expect(inlineExpressions?.[1]?.expression).toContain('ctx.onPanelRunEvent($event)')
  })

  it('uses colon event bindings for kebab-case component events', () => {
    const template = `
<CompatAltPanel @overlay-click="onOverlayClick" />
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('bind:overlay-click="__weapp_vite_inline"')
    expect(code).toContain('data-wd-overlay-click="1"')
    expect(code).toContain('data-wi-overlay-click="i0"')
    expect(code).not.toContain('bindoverlay-click=')
  })

  it('emits array-based scoped slot props', () => {
    const template = `
<slot name="item" :item="card.item" :index="card.index" />
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/components/KpiBoard/index.vue')

    expect(code).toContain('<slot name="item" /><scoped-slots-item')
    expect(code).toContain(`__wvSlotProps="{{['item',card.item,'index',card.index]}}"`)
    expect(code).not.toContain(`__wvSlotProps="{{{`)
  })

  it('keeps native slot outlet fallback for scoped named slot props', () => {
    const template = `
<slot name="main" :list="back.state.list" />
<slot name="footer" :list="back.state.list" />
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/components/BackList/index.vue')

    expect(code).toContain('<slot name="main" /><scoped-slots-main wx:if="{{__wvSlotOwnerId}}"')
    expect(code).toContain(`__wvSlotProps="{{['list',back.state.list]}}"`)
    expect(code).toContain('<slot name="footer" /><scoped-slots-footer wx:if="{{__wvSlotOwnerId}}"')
    expect(code).not.toContain('<block wx:else><slot name="main" /></block>')
  })

  it('preserves v-for on scoped slot outlets', () => {
    const template = `
<slot
  v-for="(item, index) in rows"
  :key="item.id"
  :item="item"
  :index="index"
/>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/components/ListScopedCell/index.vue',
    )

    expect(code).toContain('<block wx:for="{{rows}}" wx:for-item="item" wx:for-index="index" wx:key="id">')
    expect(code).toContain(`__wvSlotProps="{{['item',item,'index',index]}}"`)
    expect(code).toContain('__wvSlotScope="{{__wvSlotScope}}"')
    expect(code).not.toContain('<block wx:else><slot /></block>')
    expect(code).not.toContain(`'key',item.id`)
  })

  it('keeps structural directives on slot outlet elements', () => {
    const template = `
<slot v-if="abc" />
<slot v-else-if="efg" />
<slot v-else />
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/issue-502/index.vue')

    expect(code).toContain(`<block ${DEFAULT_DIRECTIVES.ifAttr}="{{abc}}"><slot`)
    expect(code).toContain(`<block ${DEFAULT_DIRECTIVES.elifAttr}="{{efg}}"><slot`)
    expect(code).toContain(`<block ${DEFAULT_DIRECTIVES.elseAttr}><slot`)
    expect(code).not.toContain('v-if')
    expect(code).not.toContain('v-else')
  })

  it('emits array-based slot scope mapping', () => {
    const template = `
<Child v-for="(item, index) in list" :key="index">
  <template #default="{ value }">
    <view>{{ value }}</view>
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`__wvSlotScope="{{['item',item,'index',index]}}"`)
    expect(code).not.toContain(`__wvSlotScope="{{{`)
  })

  it('emits augmented scoped slot components for plain default component children when enabled', () => {
    const template = `
<Provider>
  <Leaf />
</Provider>
    `.trim()

    const { code, scopedSlotComponents, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { scopedSlotsRequireProps: false },
    )

    expect(code).toContain('generic:scoped-slots-default="')
    expect(code).toContain(`vue-slots="{{__wv_bind_0}}"`)
    expect(code).toContain('__wvSlotOwnerId="{{__wvOwnerId || \'\'}}"')
    expect(code).not.toContain('<Leaf')
    expect(classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.exp === `{['default']:true}`)).toBe(true)
    expect(scopedSlotComponents).toHaveLength(1)
    expect(scopedSlotComponents?.[0]?.slotKey).toBe('default')
    expect(scopedSlotComponents?.[0]?.template).toContain('<Leaf />')
  })

  it('keeps plain named template slots native when default component children are augmented', () => {
    const template = `
<Provider>
  <template #header>
    <view>Header</view>
  </template>
</Provider>
    `.trim()

    const { code, scopedSlotComponents } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { scopedSlotsRequireProps: false },
    )

    expect(code).toContain('<view slot="header"><view>Header</view></view>')
    expect(code).not.toContain('generic:scoped-slots-header')
    expect(scopedSlotComponents).toBeUndefined()
  })

  it('keeps plain template slot content in source order with implicit default children', () => {
    const template = `
<van-cell>
  <div />
  <template #footer1>
    <view />
  </template>
  <template #footer2>
    <text />
  </template>
</van-cell>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-574/index.vue',
      {
        scopedSlotsRequireProps: false,
        slotSingleRootNoWrapper: true,
        wevuComponentTags: ['van-cell'],
      },
    )

    const defaultContentIndex = code.indexOf('<view class="div" />')
    const footer1Index = code.indexOf('<view slot="footer1" />')
    const footer2Index = code.indexOf('<text slot="footer2" />')

    expect(code).toContain(`van-cell vue-slots="{{__wv_bind_0}}"`)
    expect(defaultContentIndex).toBeGreaterThan(-1)
    expect(footer1Index).toBeGreaterThan(defaultContentIndex)
    expect(footer2Index).toBeGreaterThan(footer1Index)
  })

  it('keeps explicit default template slots native when default component children are augmented', () => {
    const template = `
<Provider>
  <template #default>
    <view>Default</view>
  </template>
</Provider>
    `.trim()

    const { code, scopedSlotComponents, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { scopedSlotsRequireProps: false },
    )

    expect(code).toContain(`<Provider vue-slots="{{__wv_bind_0}}"><view>Default</view></Provider>`)
    expect(code).not.toContain('vue-slot-flags')
    expect(code).not.toContain('generic:scoped-slots-default')
    expect(classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.exp === `{['default']:true}`)).toBe(true)
    expect(scopedSlotComponents).toBeUndefined()
  })

  it('keeps implicit default native when direct children are native elements', () => {
    const template = `
<Provider>
  <view>
    <Leaf />
  </view>
</Provider>
    `.trim()

    const { code, scopedSlotComponents } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { scopedSlotsRequireProps: false },
    )

    expect(code).toContain(`<Provider vue-slots="{{__wv_bind_0}}"><view><Leaf /></view></Provider>`)
    expect(code).not.toContain('vue-slot-flags')
    expect(code).not.toContain('generic:scoped-slots-default')
    expect(scopedSlotComponents).toBeUndefined()
  })

  it('emits augmented scoped slot components for wrapped plain default children when explicitly augmented', () => {
    const template = `
<Provider>
  <view>
    <Leaf />
  </view>
</Provider>
    `.trim()

    const { code, scopedSlotComponents } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { scopedSlotsCompiler: 'augmented' },
    )

    expect(code).toContain('generic:scoped-slots-default="')
    expect(code).toContain('__wvSlotOwnerId="{{__wvOwnerId || \'\'}}"')
    expect(code).not.toContain('<view><Leaf /></view>')
    expect(scopedSlotComponents).toHaveLength(1)
    expect(scopedSlotComponents?.[0]?.template).toContain('<view><Leaf /></view>')
  })

  it('uses owner proxy for augmented scoped slot runtime call bindings', () => {
    const template = `
<Cell>
  <text>{{ func(text) }}</text>
</Cell>
    `.trim()

    const { code, scopedSlotComponents } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-558/index.vue',
      {
        scopedSlotsCompiler: 'augmented',
        scopedSlotsRequireProps: false,
      },
    )

    expect(code).toContain('generic:scoped-slots-default="')
    expect(scopedSlotComponents).toHaveLength(1)
    const slot = scopedSlotComponents?.[0]
    expect(slot?.template).toContain('<text>{{__wv_bind_0}}</text>')
    expect(slot?.classStyleBindings?.[0]?.exp).toBe('func(text)')
    const computedCode = buildClassStyleComputedCode(slot?.classStyleBindings ?? [], {
      normalizeClassName: '__wevuNormalizeClass',
      normalizeStyleName: '__wevuNormalizeStyle',
      unrefName: '__wevuUnref',
    })
    expect(computedCode).toContain('this.__wvOwnerProxy.func')
    expect(computedCode).toContain('this.__wvOwnerProxy.text')
    expect(computedCode).not.toContain('this.__wvOwner.func')
  })

  it('uses owner proxy across augmented default, named, scoped and nested slots', () => {
    const template = `
<Cell>
  <text>{{ func(text) }}</text>
</Cell>
<NamedSlotCard>
  <template #header>
    <text>{{ func(headerText) }}</text>
  </template>
  <template #default>
    <text>{{ func(defaultText) }}</text>
  </template>
  <template #footer="{ suffix }">
    <text>{{ func(text + suffix) }}</text>
  </template>
</NamedSlotCard>
<DefaultScopedCell v-slot="{ label, count }">
  <text v-if="visible">{{ func(label + '-' + count + '-' + text) }}</text>
</DefaultScopedCell>
<ListScopedCell v-slot="{ item, index }">
  <text>{{ func(item.label + '-' + index + '-' + text) }}</text>
</ListScopedCell>
<Issue558NestedSlotGroup>
  <Issue558NestedSlotCell>
    <text>{{ func(nestedText) }}</text>
  </Issue558NestedSlotCell>
</Issue558NestedSlotGroup>
    `.trim()

    const { code, scopedSlotComponents, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-558/index.vue',
      {
        scopedSlotsCompiler: 'augmented',
        scopedSlotsRequireProps: false,
      },
    )

    expect(code).toContain('generic:scoped-slots-default="')
    expect(code).toContain('generic:scoped-slots-header="')
    expect(code).toContain('generic:scoped-slots-footer="')
    expect(code).not.toContain('<Issue558NestedSlotCell>')
    expect(classStyleBindings?.some(binding => binding.exp === 'func(headerText)')).toBe(false)
    expect(classStyleBindings?.some(binding => binding.exp === 'func(defaultText)')).toBe(false)
    expect(scopedSlotComponents).toHaveLength(8)

    const defaultSlots = scopedSlotComponents?.filter(slot => slot.slotKey === 'default') ?? []
    const headerSlot = scopedSlotComponents?.find(slot => slot.slotKey === 'header')
    const footerSlot = scopedSlotComponents?.find(slot => slot.slotKey === 'footer')
    const findDefaultSlotByBinding = (exp: string) => {
      return defaultSlots.find(slot => slot.classStyleBindings?.some(binding => binding.exp === exp))
    }
    const implicitDefault = findDefaultSlotByBinding('func(text)')
    const explicitDefault = findDefaultSlotByBinding('func(defaultText)')
    const defaultScoped = findDefaultSlotByBinding('func(label + \'-\' + count + \'-\' + text)')
    const listScoped = findDefaultSlotByBinding('func(item.label + \'-\' + index + \'-\' + text)')
    const nestedOuter = defaultSlots.find(slot => slot.template.includes('<Issue558NestedSlotCell generic:scoped-slots-default='))
    const nestedInner = findDefaultSlotByBinding('func(nestedText)')

    expect(implicitDefault?.template).toContain('<text>{{__wv_bind_0}}</text>')
    expect(headerSlot?.template).toContain('<text>{{__wv_bind_0}}</text>')
    expect(explicitDefault?.template).toContain('<text>{{__wv_bind_0}}</text>')
    expect(footerSlot?.template).toContain('<text>{{__wv_bind_0}}</text>')
    expect(defaultScoped?.template).toContain('<block wx:if="{{__wv_bind_1}}"><text>{{__wv_bind_0}}</text></block>')
    expect(listScoped?.template).toContain('<text>{{__wv_bind_0}}</text>')
    expect(nestedOuter?.template).toContain('<Issue558NestedSlotCell generic:scoped-slots-default=')
    expect(nestedOuter?.template).toContain('__wvSlotOwnerId="{{__wvSlotOwnerId || __wvOwnerId || \'\'}}"')
    expect(nestedInner?.template).toContain('<text>{{__wv_bind_0}}</text>')

    expectScopedSlotComputed(implicitDefault?.classStyleBindings, 'func(text)', [
      'this.__wvOwnerProxy.func',
      'this.__wvOwnerProxy.text',
    ])
    expectScopedSlotComputed(headerSlot?.classStyleBindings, 'func(headerText)', [
      'this.__wvOwnerProxy.func',
      'this.__wvOwnerProxy.headerText',
    ])
    expectScopedSlotComputed(explicitDefault?.classStyleBindings, 'func(defaultText)', [
      'this.__wvOwnerProxy.func',
      'this.__wvOwnerProxy.defaultText',
    ])
    expectScopedSlotComputed(footerSlot?.classStyleBindings, 'func(text + suffix)', [
      'this.__wvOwnerProxy.func',
      'this.__wvOwnerProxy.text',
      'this.__wvSlotPropsData.suffix',
    ])
    expectScopedSlotComputed(defaultScoped?.classStyleBindings, 'func(label + \'-\' + count + \'-\' + text)', [
      'this.__wvOwnerProxy.func',
      'this.__wvOwnerProxy.text',
      'this.__wvSlotPropsData.label',
      'this.__wvSlotPropsData.count',
    ])
    expectScopedSlotComputed(defaultScoped?.classStyleBindings, 'visible', [
      'this.__wvOwnerProxy.visible',
    ])
    expectScopedSlotComputed(listScoped?.classStyleBindings, 'func(item.label + \'-\' + index + \'-\' + text)', [
      'this.__wvOwnerProxy.func',
      'this.__wvOwnerProxy.text',
      'this.__wvSlotPropsData.item',
      'this.__wvSlotPropsData.index',
    ])
    expectScopedSlotComputed(nestedInner?.classStyleBindings, 'func(nestedText)', [
      'this.__wvOwnerProxy.func',
      'this.__wvOwnerProxy.nestedText',
    ])
  })

  it('emits nested augmented scoped slot components for multi-level default component children', () => {
    const template = `
<MyCellGroup>
  <MyCell>
    <MyImage />
  </MyCell>
</MyCellGroup>
    `.trim()

    const { code, scopedSlotComponents } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-547/index.vue',
      { scopedSlotsCompiler: 'augmented' },
    )

    expect(code).toContain('generic:scoped-slots-default="')
    expect(code).not.toContain('<MyCell ')
    expect(scopedSlotComponents).toHaveLength(2)
    expect(scopedSlotComponents?.[0]?.template).toContain('<MyCell generic:scoped-slots-default="')
    expect(scopedSlotComponents?.[0]?.template).not.toContain('<MyImage')
    expect(scopedSlotComponents?.[0]?.componentGenerics).toBeUndefined()
    expect(scopedSlotComponents?.[1]?.template).toContain('<MyImage />')
    expect(scopedSlotComponents?.[1]?.componentGenerics).toBeUndefined()
  })

  it('keeps native component plain default slots inline inside augmented scoped slot components', () => {
    const template = `
<native-tabbar>
  <native-tabbar-item
    v-for="{ label, icon, to } in tabItems"
    :key="label"
    :icon="icon"
    :name="to.name"
  >
    {{ label }}
  </native-tabbar-item>
</native-tabbar>
    `.trim()

    const { code, scopedSlotComponents } = compileVueTemplateToWxml(
      template,
      '/project/src/custom-tab-bar/index.vue',
      {
        scopedSlotsCompiler: 'augmented',
        wevuComponentTags: [],
      },
    )

    expect(code).toContain('generic:scoped-slots-default="')
    expect(scopedSlotComponents).toHaveLength(1)
    expect(scopedSlotComponents?.[0]?.id).toBe('default-0')
    expect(scopedSlotComponents?.[0]?.hostComponentName).toBe('native-tabbar')
    expect(scopedSlotComponents?.[0]?.template).toContain('<native-tabbar-item wx:for="{{__wv_bind_0}}"')
    expect(scopedSlotComponents?.[0]?.template).toContain('>{{__wv_item_0.label}}</native-tabbar-item>')
    expect(scopedSlotComponents?.[0]?.template).not.toContain('generic:scoped-slots-default')
    expect(scopedSlotComponents?.[0]?.classStyleBindings?.[0]).toMatchObject({
      name: '__wv_bind_0',
      type: 'bind',
      exp: 'tabItems',
      forStack: [],
    })
    expect(scopedSlotComponents?.[0]?.componentGenerics).toBeUndefined()
  })

  it('keeps wrapped plain default children native when explicit require props wins over augmented mode', () => {
    const template = `
<Provider>
  <view>
    <Leaf />
  </view>
</Provider>
    `.trim()

    const { code, scopedSlotComponents } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      {
        scopedSlotsCompiler: 'augmented',
        scopedSlotsRequireProps: true,
      },
    )

    expect(code).toContain('<Provider vue-slots="{{__wv_bind_0}}"><view><Leaf /></view></Provider>')
    expect(code).not.toContain('generic:scoped-slots-default')
    expect(scopedSlotComponents).toBeUndefined()
  })

  it('keeps implicit default native for kebab-case mini program components', () => {
    const template = `
<t-cell-group>
  <t-cell title="Composition API" />
</t-cell-group>
    `.trim()

    const { code, scopedSlotComponents } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { scopedSlotsRequireProps: false },
    )

    expect(code).toContain('<t-cell-group><t-cell title="Composition API" /></t-cell-group>')
    expect(code).not.toContain('generic:scoped-slots-default')
    expect(scopedSlotComponents).toBeUndefined()
  })

  it('keeps third-party kebab-case component slots native even when slot content uses Vue components', () => {
    const template = `
<t-button>
  <MyIcon />
  保存
</t-button>
    `.trim()

    const { code, scopedSlotComponents } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      {
        scopedSlotsRequireProps: false,
        wevuComponentTags: ['MyIcon', 'my-icon'],
      },
    )

    expect(code).toContain('<t-button>')
    expect(code).toContain('<MyIcon />')
    expect(code).toContain('保存')
    expect(code).toContain('</t-button>')
    expect(code).not.toContain('generic:scoped-slots-default')
    expect(scopedSlotComponents).toBeUndefined()
  })

  it('keeps common third-party mini program slot patterns native', () => {
    expectNativeThirdPartySlotOutput(
      `
<t-button>保存</t-button>
      `,
      ['<t-button>保存</t-button>'],
    )

    expectNativeThirdPartySlotOutput(
      `
<t-cell-group>
  <t-cell title="Composition API" />
</t-cell-group>
      `,
      ['<t-cell-group><t-cell title="Composition API" /></t-cell-group>'],
    )

    expectNativeThirdPartySlotOutput(
      `
<van-cell>
  <template #title>
    <MyTitle />
  </template>
  <template #label>
    说明
  </template>
</van-cell>
      `,
      [
        '<van-cell>',
        '<view slot="title"><MyTitle /></view>',
        '<view slot="label">说明</view>',
        '</van-cell>',
      ],
      { wevuComponentTags: ['MyTitle', 'my-title'] },
    )

    expectNativeThirdPartySlotOutput(
      `
<van-tabbar>
  <van-tabbar-item
    v-for="{ label, icon, to } in tabItems"
    :key="label"
    :icon="icon"
    :name="to.name"
  >
    {{ label }}
  </van-tabbar-item>
</van-tabbar>
      `,
      [
        '<van-tabbar>',
        '<van-tabbar-item wx:for="{{tabItems}}"',
        '>{{__wv_item_0.label}}</van-tabbar-item>',
        '</van-tabbar>',
      ],
    )
  })

  it('ignores comments when checking implicit default slot children', () => {
    const template = `
<map>
  <!-- eslint-disable-next-line vue/valid-v-slot -->
  <template #callout>
    <cover-view>Callout</cover-view>
  </template>
</map>
    `.trim()

    const { code, scopedSlotComponents } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { scopedSlotsRequireProps: false },
    )

    expect(code).toContain('<view slot="callout"><cover-view>Callout</cover-view></view>')
    expect(code).not.toContain('generic:scoped-slots-default')
    expect(scopedSlotComponents).toBeUndefined()
  })

  it('keeps native element children inline when plain default scoped slots are enabled', () => {
    const template = `
<view>
  <Leaf />
</view>
    `.trim()

    const { code, scopedSlotComponents } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { scopedSlotsRequireProps: false },
    )

    expect(code).toContain('<view><Leaf /></view>')
    expect(code).not.toContain('generic:scoped-slots-default')
    expect(scopedSlotComponents).toBeUndefined()
  })

  it('guards generated scoped slot outlet by owner id', () => {
    const { code, componentGenerics } = compileVueTemplateToWxml(
      '<slot />',
      '/project/src/components/provider/index.vue',
      { scopedSlotsRequireProps: false },
    )

    expect(code).toContain('<scoped-slots-default')
    expect(code).toContain('wx:if="{{__wvSlotOwnerId}}"')
    expect(componentGenerics?.['scoped-slots-default']).toBe(true)
  })

  it('keeps plain named slot outlet native when default scoped slots are enabled', () => {
    const { code, componentGenerics } = compileVueTemplateToWxml(
      '<slot name="action" />',
      '/project/src/components/provider/index.vue',
      { scopedSlotsRequireProps: false },
    )

    expect(code).toBe('<slot name="action" />')
    expect(componentGenerics?.['scoped-slots-action']).toBeUndefined()
  })

  it('compiles slot fallback content to presence-guarded branches', () => {
    const template = `
<slot name="header"><view>Fallback header</view></slot>
<slot><text>{{ fallbackDefault }}</text></slot>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/components/provider/index.vue',
      { scopedSlotsRequireProps: false },
    )

    expect(code).toContain(`<block wx:if="{{vueSlots&&vueSlots.header}}">`)
    expect(code).toContain(`<slot name="header" /></block><block wx:else><view>Fallback header</view></block>`)
    expect(code).toContain(`<block wx:if="{{vueSlots&&vueSlots.default}}">`)
    expect(code).toContain(`<slot /></block><block wx:else><text>{{fallbackDefault}}</text></block>`)
    expect(code).not.toContain('vueSlots[')
    expect(code).not.toContain('<slot name="header"><view>Fallback header</view></slot>')
    expect(code).not.toContain('<slot><text>{{fallbackDefault}}</text></slot>')
  })

  it('compiles scoped slot fallback content to presence-guarded branches', () => {
    const template = `
<slot :item="card.item" :index="card.index">
  <view class="fallback">{{ fallbackDefault }}</view>
</slot>
    `.trim()

    const { code, warnings, componentGenerics } = compileVueTemplateToWxml(
      template,
      '/project/src/components/provider/index.vue',
    )

    expect(code).toContain(`<block wx:if="{{vueSlots&&vueSlots.default}}">`)
    expect(code).not.toContain(`<block wx:else><slot /></block>`)
    expect(code).toContain(`<scoped-slots-default wx:if="{{__wvSlotOwnerId}}" __wvSlotOwnerId="{{__wvSlotOwnerId}}" __wvSlotProps="{{['item',card.item,'index',card.index]}}" __wvSlotScope="{{__wvSlotScope}}" />`)
    expect(code).toContain(`</block><block wx:else><view class="fallback">{{fallbackDefault}}</view></block>`)
    expect(code).not.toContain('不支持作用域插槽的兜底内容')
    expect(warnings.some(message => message.includes('不支持作用域插槽的兜底内容'))).toBe(false)
    expect(componentGenerics?.['scoped-slots-default']).toBe(true)
  })

  it('keeps slot fallback branches nested inside v-if chains', () => {
    const template = `
<slot v-if="a" name="header"><view>A fallback</view></slot>
<slot v-else-if="b" name="header"><view>B fallback</view></slot>
<slot v-else name="header"><view>C fallback</view></slot>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/components/provider/index.vue',
      { scopedSlotsRequireProps: false },
    )

    expect(code).toContain(`<block ${DEFAULT_DIRECTIVES.ifAttr}="{{a}}"><block ${DEFAULT_DIRECTIVES.ifAttr}="{{vueSlots&&vueSlots.header}}">`)
    expect(code).toContain(`<slot name="header" /></block><block ${DEFAULT_DIRECTIVES.elseAttr}><view>A fallback</view></block></block>`)
    expect(code).toContain(`<block ${DEFAULT_DIRECTIVES.elifAttr}="{{b}}"><block ${DEFAULT_DIRECTIVES.ifAttr}="{{vueSlots&&vueSlots.header}}">`)
    expect(code).toContain(`<slot name="header" /></block><block ${DEFAULT_DIRECTIVES.elseAttr}><view>B fallback</view></block></block>`)
    expect(code).toContain(`<block ${DEFAULT_DIRECTIVES.elseAttr}><block ${DEFAULT_DIRECTIVES.ifAttr}="{{vueSlots&&vueSlots.header}}">`)
    expect(code).toContain(`<slot name="header" /></block><block ${DEFAULT_DIRECTIVES.elseAttr}><view>C fallback</view></block></block>`)
    expect(code).not.toContain('vueSlots[')
  })

  it('warns when component v-slot and template v-slot are mixed, preferring component slot', () => {
    const template = `
<Child v-slot="{ item }">
  <view>{{ item }}</view>
  <template #extra>
    <view>extra</view>
  </template>
</Child>
    `.trim()

    const { code, warnings, scopedSlotComponents } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(warnings.some(message => message.includes('组件上的 v-slot 与 <template v-slot> 不能同时使用'))).toBe(true)
    expect(code).toContain('vue-slots=')
    expect(scopedSlotComponents).toHaveLength(1)
    expect(scopedSlotComponents?.[0]?.template).toContain('__wvSlotPropsData.item')
    expect(scopedSlotComponents?.[0]?.template).toContain('<view>extra</view>')
  })

  it('falls back to plain slot rendering when scoped slot compiler is disabled', () => {
    const template = `
<Child>
  <template #header="{ title }">
    <view>{{ title }}</view>
  </template>
</Child>
<slot :item="card.item"><view>fallback</view></slot>
    `.trim()

    const { code, warnings, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { scopedSlotsCompiler: 'off' },
    )

    expect(warnings.some(message => message.includes('已禁用作用域插槽参数'))).toBe(true)
    expect(code).toContain('<view slot="header"><view>{{title}}</view></view>')
    expect(code).toContain('<slot><view>fallback</view></slot>')
    expect(code).toContain(`vue-slots="{{__wv_bind_0}}"`)
    expect(classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.exp === `{['header']:true}`)).toBe(true)
    expect(code).not.toContain('__wvSlotProps=')
  })

  it('keeps plain slot fallback presence-guarded when scoped slot compiler is disabled', () => {
    const template = `
<slot name="header"><view>Fallback header</view></slot>
<slot><text>{{ fallbackDefault }}</text></slot>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/components/provider/index.vue',
      { scopedSlotsCompiler: 'off' },
    )

    expect(code).toContain(`<block wx:if="{{vueSlots&&vueSlots.header}}">`)
    expect(code).toContain(`<slot name="header" /></block><block wx:else><view>Fallback header</view></block>`)
    expect(code).toContain(`<block wx:if="{{vueSlots&&vueSlots.default}}">`)
    expect(code).toContain(`<slot /></block><block wx:else><text>{{fallbackDefault}}</text></block>`)
    expect(code).not.toContain('<slot name="header"><view>Fallback header</view></slot>')
    expect(code).not.toContain('<slot><text>{{fallbackDefault}}</text></slot>')
  })

  it('keeps plain named slot single child wrapped by default', () => {
    const template = `
<Child>
  <template #icon>
    <img class="probe" src="/cover.png" />
  </template>
</Child>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('<view slot="icon"><image class="img probe" src="/cover.png" /></view>')
    expect(code).toContain(`vue-slots="{{__wv_bind_0}}"`)
    expect(classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.exp === `{['icon']:true}`)).toBe(true)
  })

  it('keeps forwarded slot outlet plain inside wrapped named slot content', () => {
    const template = `
<Child>
  <template #header>
    <slot />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
    )

    expect(code).toContain('<view slot="header"><slot /></view>')
    expect(code).not.toContain('<slot slot="header"')
    expect(code).not.toContain('<scoped-slots-default')
  })

  it('uses configured global slot fallback wrapper tag', () => {
    const template = `
<Child>
  <template #header>
    <slot />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      {
        slotFallbackWrapper: 'cover-view',
      },
    )

    expect(code).toContain('<cover-view slot="header"><slot /></cover-view>')
    expect(code).not.toContain('<view slot="header"><slot /></view>')
  })

  it('uses component and slot matched fallback wrapper rules for multiple named slots', () => {
    const template = `
<Child>
  <template #header>
    <slot />
  </template>
  <template #footer>
    <slot />
  </template>
</Child>
<Other>
  <template #header>
    <slot />
  </template>
</Other>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      {
        slotFallbackWrapper: {
          tag: 'view',
          rules: [
            { component: 'Child', slot: 'header', tag: 'cover-view' },
            { component: 'Child', slot: 'footer', tag: 'text' },
            { component: 'Other', slot: 'header', tag: 'custom-header' },
          ],
        },
      },
    )

    expect(code).toContain('<cover-view slot="header"><slot /></cover-view>')
    expect(code).toContain('<text slot="footer"><slot /></text>')
    expect(code).toContain('<custom-header slot="header"><slot /></custom-header>')
  })

  it('uses resolved defineOptions component name for fallback wrapper rules', () => {
    const template = `
<child-alias>
  <template #header>
    <slot />
  </template>
  <template #footer>
    <slot />
  </template>
</child-alias>
<OtherAlias>
  <template #header>
    <slot />
  </template>
</OtherAlias>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      {
        componentNameMap: {
          'child-alias': 'HelloWorld',
          'OtherAlias': 'HelloWorld',
        },
        slotFallbackWrapper: {
          tag: 'view',
          rules: [
            { componentName: 'HelloWorld', slot: 'header', tag: 'cover-view' },
            { component: 'child-alias', componentName: 'HelloWorld', slot: 'footer', tag: 'text' },
          ],
        },
      },
    )

    expect(code).toContain('<cover-view slot="header"><slot /></cover-view>')
    expect(code).toContain('<text slot="footer"><slot /></text>')
    expect(code).toContain('<OtherAlias vue-slots="{{__wv_bind_0}}"><cover-view slot="header"><slot /></cover-view></OtherAlias>')
  })

  it('uses component-level and slot-specific local fallback wrapper config', () => {
    const template = `
<Child slot-wrapper="cover-view" slot-wrapper-footer="text">
  <template #header>
    <slot />
  </template>
  <template #footer>
    <slot />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      {
        slotFallbackWrapper: 'view',
      },
    )

    expect(code).toContain('<Child')
    expect(code).not.toContain('slot-wrapper=')
    expect(code).not.toContain('slot-wrapper-footer=')
    expect(code).toContain('<cover-view slot="header"><slot /></cover-view>')
    expect(code).toContain('<text slot="footer"><slot /></text>')
  })

  it('passes configured attrs to slot fallback wrappers', () => {
    const template = `
<Child>
  <template #header>
    <slot />
  </template>
  <template #footer>
    <slot />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      {
        slotFallbackWrapper: {
          tag: 'view',
          attrs: {
            'class': 'slot-wrapper',
            'data-role': 'fallback',
          },
          rules: [
            {
              component: 'Child',
              slot: 'footer',
              attrs: {
                class: 'footer-wrapper',
              },
            },
          ],
        },
      },
    )

    expect(code).toContain('<view slot="header" class="slot-wrapper" data-role="fallback"><slot /></view>')
    expect(code).toContain('<view slot="footer" class="footer-wrapper" data-role="fallback"><slot /></view>')
  })

  it('uses component-level and slot-specific local fallback wrapper class and style', () => {
    const template = `
<Child
  slot-wrapper="cover-view"
  slot-wrapper-class="slot-default"
  slot-wrapper-style="padding: 8px"
  slot-wrapper-footer="view"
  slot-wrapper-footer-class="slot-footer"
  slot-wrapper-footer-style="margin-top: 12px"
>
  <template #header>
    <slot />
  </template>
  <template #footer>
    <slot />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      {
        slotFallbackWrapper: 'view',
      },
    )

    expect(code).toContain('<cover-view slot="header" class="slot-default" style="padding: 8px"><slot /></cover-view>')
    expect(code).toContain('<view slot="footer" class="slot-footer" style="margin-top: 12px"><slot /></view>')
  })

  it('uses template-level fallback wrapper config as nearest slot override', () => {
    const template = `
<Child
  slot-wrapper="cover-view"
  slot-wrapper-class="slot-default"
  slot-wrapper-style="padding: 8px"
  slot-wrapper-header="view"
  slot-wrapper-header-class="slot-header-owner"
>
  <template
    #header
    slot-wrapper="text"
    slot-wrapper-class="slot-header-template"
    slot-wrapper-style="margin-top: 12px"
  >
    <slot />
  </template>
  <template #footer>
    <slot />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      {
        slotFallbackWrapper: 'view',
      },
    )

    expect(code).toContain('<text slot="header" class="slot-header-template" style="margin-top: 12px"><slot /></text>')
    expect(code).toContain('<cover-view slot="footer" class="slot-default" style="padding: 8px"><slot /></cover-view>')
    expect(code).not.toContain('slot-wrapper=')
    expect(code).not.toContain('slot-wrapper-header=')
  })

  it('supports dynamic template-level fallback wrapper class and style', () => {
    const template = `
<Child :slot-wrapper-class="ownerClass">
  <template
    #header
    slot-wrapper="cover-view"
    :slot-wrapper-class="headerClass"
    :slot-wrapper-style="headerStyle"
  >
    <slot />
  </template>
  <template #footer>
    <slot />
  </template>
</Child>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      {
        slotFallbackWrapper: 'view',
      },
    )

    expect(code).toContain('<cover-view slot="header" class="{{__wv_cls_0}}" style="{{__wv_style_0}}"><slot /></cover-view>')
    expect(code).toContain('<view slot="footer" class="{{__wv_cls_1}}"><slot /></view>')
    expect(classStyleBindings?.some(binding => binding.name === '__wv_cls_0' && binding.exp.includes('headerClass'))).toBe(true)
    expect(classStyleBindings?.some(binding => binding.name === '__wv_style_0' && binding.exp.includes('headerStyle'))).toBe(true)
    expect(classStyleBindings?.some(binding => binding.name === '__wv_cls_1' && binding.exp.includes('ownerClass'))).toBe(true)
  })

  it('supports dynamic local fallback wrapper class and style', () => {
    const template = `
<Child
  :slot-wrapper-class="headerClass"
  :slot-wrapper-style="headerStyle"
  :slot-wrapper-footer-class="footerClass"
>
  <template #header>
    <slot />
  </template>
  <template #footer>
    <slot />
  </template>
</Child>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      {
        slotFallbackWrapper: 'view',
      },
    )

    expect(code).toContain('<view slot="header" class="{{__wv_cls_0}}" style="{{__wv_style_0}}"><slot /></view>')
    expect(code).toContain('<view slot="footer" class="{{__wv_cls_1}}" style="{{__wv_style_1}}"><slot /></view>')
    expect(classStyleBindings?.some(binding => binding.name === '__wv_cls_0' && binding.exp.includes('headerClass'))).toBe(true)
    expect(classStyleBindings?.some(binding => binding.name === '__wv_style_0' && binding.exp.includes('headerStyle'))).toBe(true)
    expect(classStyleBindings?.some(binding => binding.name === '__wv_cls_1' && binding.exp.includes('footerClass'))).toBe(true)
    expect(classStyleBindings?.some(binding => binding.name === '__wv_style_1' && binding.exp.includes('headerStyle'))).toBe(true)
  })

  it('supports colon-style local fallback wrapper config for compatibility', () => {
    const template = `
<Child slot-wrapper:footer="text">
  <template #footer>
    <slot />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      {
        slotFallbackWrapper: 'view',
      },
    )

    expect(code).not.toContain('slot-wrapper:footer=')
    expect(code).toContain('<text slot="footer"><slot /></text>')
  })

  it('uses configured single-root no-wrapper strategy per component slot', () => {
    const template = `
<Child>
  <template #header>
    <image src="/cover.png" />
  </template>
  <template #footer>
    <image src="/footer.png" />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      {
        slotFallbackWrapper: {
          tag: 'view',
          rules: [
            { component: 'Child', slot: 'header', singleRootNoWrapper: true },
            { component: 'Child', slot: 'footer', tag: 'cover-view' },
          ],
        },
      },
    )

    expect(code).toContain('<image slot="header" src="/cover.png" />')
    expect(code).toContain('<cover-view slot="footer"><image src="/footer.png" /></cover-view>')
  })

  it('projects fallback wrapper attrs when single-root no-wrapper succeeds', () => {
    const template = `
<Child slot-wrapper-class="slot-icon" slot-single-root-no-wrapper-icon>
  <template #icon>
    <image src="/cover.png" />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      {
        slotFallbackWrapper: 'view',
      },
    )

    expect(code).toContain('<image slot="icon" class="slot-icon" src="/cover.png" />')
  })

  it('projects template-level fallback wrapper attrs when single-root no-wrapper succeeds', () => {
    const template = `
<Child slot-wrapper-class="owner-icon">
  <template #icon slot-wrapper-class="template-icon" slot-single-root-no-wrapper>
    <image src="/cover.png" />
  </template>
  <template #footer>
    <slot />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      {
        slotFallbackWrapper: 'view',
      },
    )

    expect(code).toContain('<image slot="icon" class="template-icon" src="/cover.png" />')
    expect(code).toContain('<view slot="footer" class="owner-icon"><slot /></view>')
  })

  it('falls back from block slot fallback wrapper to view with a warning', () => {
    const template = `
<Child>
  <template #header>
    <slot />
  </template>
</Child>
    `.trim()

    const { code, warnings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      {
        slotFallbackWrapper: 'block',
      },
    )

    expect(code).toContain('<view slot="header"><slot /></view>')
    expect(code).not.toContain('<block slot="header">')
    expect(warnings).toContain('slot fallback wrapper 不支持配置为 block，已回退为 view。')
  })

  it('emits slot presence metadata for implicit default slots', () => {
    const template = `
<Child>
  <view>default content</view>
</Child>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`vue-slots="{{__wv_bind_0}}"`)
    expect(classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.exp === `{['default']:true}`)).toBe(true)
  })

  it('emits slot presence metadata for implicit default slots inside v-for components', () => {
    const template = `
<MyCell v-for="{ key, src } in items" :key="key">
  <image :src="src" />
</MyCell>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('<MyCell ')
    expect(code).toContain(`${DEFAULT_DIRECTIVES.forAttr}="{{items}}"`)
    expect(code).toContain(`${DEFAULT_DIRECTIVES.forItemAttr}="__wv_item_0"`)
    expect(code).toContain(`${DEFAULT_DIRECTIVES.keyAttr}="key"`)
    expect(code).toContain(`vue-slots="{{__wv_bind_0[__wv_index_1]}}"`)
    expect(code).toContain('<image src="{{__wv_item_0.src}}" />')
    expect(classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.exp === `{['default']:true}`)).toBe(true)
  })

  it('guards plain slot metadata and fallback content with template v-if', () => {
    const template = `
<Child>
  <template #header v-if="showHeader">
    <view>Header</view>
  </template>
</Child>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`vue-slots="{{__wv_bind_0}}"`)
    expect(code).not.toContain('vue-slot-flags')
    expect(classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.exp === `{['header']:(showHeader)}`)).toBe(true)
    expect(code).toContain(`<block ${DEFAULT_DIRECTIVES.ifAttr}="{{showHeader}}"><view slot="header">`)
  })

  it('keeps repeated conditional slot templates in slot metadata order', () => {
    const template = `
<Child>
  <template #header v-if="showPrimary">
    <view>Primary</view>
  </template>
  <template #header v-if="showSecondary">
    <view>Secondary</view>
  </template>
</Child>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`vue-slots="{{__wv_bind_0}}"`)
    expect(code).not.toContain('vue-slot-flags')
    expect(classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.exp === `{['header']:(showPrimary)||(showSecondary)}`)).toBe(true)
  })

  it('keeps v-if and v-else named slot branches intact', () => {
    const template = `
<Card>
  <template #header v-if="abc">
    <view />
  </template>
  <template #header v-else>
    <text />
  </template>
</Card>
    `.trim()

    const { code, classStyleBindings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`<Card vue-slots="{{__wv_bind_0}}">`)
    expect(code).toContain(`<block ${DEFAULT_DIRECTIVES.ifAttr}="{{abc}}"><view slot="header"><view /></view></block>`)
    expect(code).toContain(`<block ${DEFAULT_DIRECTIVES.elseAttr}><view slot="header"><text /></view></block>`)
    expect(code).not.toContain('<view slot="header"><text /></view></Card>')
    expect(classStyleBindings?.some(binding => binding.name === '__wv_bind_0' && binding.exp === `{['header']:true}`)).toBe(true)
  })

  it('projects plain named slot single child without synthetic view wrapper when enabled', () => {
    const template = `
<Child>
  <template #icon>
    <img class="probe" src="/cover.png" />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { slotSingleRootNoWrapper: true },
    )

    expect(code).toContain('<image slot="icon" class="img probe" src="/cover.png" />')
    expect(code).not.toContain('<view slot="icon">')
  })

  it('keeps forwarded slot outlet wrapped inside plain named slot when default slot augmentation is enabled', () => {
    const template = `
<Child>
  <template #header>
    <slot />
  </template>
  <template #footer>
    <slot name="footer" />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/issue-613/index.vue',
      { slotSingleRootNoWrapper: true },
    )

    expect(code).toContain('<view slot="header"><slot /></view>')
    expect(code).toContain('<view slot="footer"><slot name="footer" /></view>')
    expect(code).not.toContain('<slot slot="header"')
    expect(code).not.toContain('<slot slot="footer"')
    expect(code).not.toContain('<scoped-slots-default slot="header"')
  })

  it('projects plain named slot v-if single child without putting slot on block when enabled', () => {
    const template = `
<Child>
  <template #text>
    <text v-if="value" v-text="value" />
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { slotSingleRootNoWrapper: true },
    )

    expect(code).toContain(`<block ${DEFAULT_DIRECTIVES.ifAttr}="{{value}}"><text slot="text">{{value}}</text></block>`)
    expect(code).not.toContain('<block slot="text"')
    expect(code).not.toContain('<view slot="text">')
  })

  it('keeps plain named slot multiple children wrapped when enabled', () => {
    const template = `
<Child>
  <template #header>
    <view>A</view>
    <view>B</view>
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { slotSingleRootNoWrapper: true },
    )

    expect(code).toContain('<view slot="header"><view>A</view><view>B</view></view>')
    expect(code).not.toContain('<block slot="header">')
  })

  it.each([
    ['weapp', 'bindtap'],
    ['alipay', 'onTap'],
    ['tt', 'bindtap'],
    ['swan', 'bindtap'],
    ['jd', 'bindtap'],
    ['xhs', 'bindtap'],
  ])('applies platform template attrs for %s', (platform, expectedEventAttr) => {
    const template = `
<view v-if="ok">A</view>
<view v-else-if="other">B</view>
<view v-else>C</view>
<view v-for="(item, index) in list" :key="item.id" @tap="onTap">{{ item.name }}</view>
    `.trim()

    const templatePlatform = getMiniProgramTemplatePlatform(platform as any)
    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { platform: templatePlatform },
    )

    expect(code).toContain(templatePlatform.directives.ifAttr)
    expect(code).toContain(templatePlatform.directives.elifAttr)
    expect(code).toContain(templatePlatform.directives.elseAttr)
    expect(code).toContain(templatePlatform.directives.forAttr)
    expect(code).toContain(templatePlatform.directives.keyAttr)
    expect(code).toContain(expectedEventAttr)
  })

  it.each([
    ['weapp', '@tap="onTap"', 'bindtap="onTap"'],
    ['weapp', '@tap.stop="onTap"', 'catchtap="onTap"'],
    ['weapp', '@tap.catch="onTap"', 'catchtap="onTap"'],
    ['weapp', '@tap.capture="onTap"', 'capture-bind:tap="onTap"'],
    ['weapp', '@tap.capture.stop="onTap"', 'capture-catch:tap="onTap"'],
    ['weapp', '@tap.stop.capture="onTap"', 'capture-catch:tap="onTap"'],
    ['weapp', '@tap.capture.catch="onTap"', 'capture-catch:tap="onTap"'],
    ['weapp', '@tap.mut="onTap"', 'mut-bind:tap="onTap"'],
    ['weapp', '@tap.catch.capture="onTap"', 'capture-catch:tap="onTap"'],
    ['weapp', '@tap.prevent="onTap"', 'bindtap="onTap"'],
    ['weapp', '@tap.once="onTap"', 'bindtap="onTap"'],
    ['weapp', '@tap.self="onTap"', 'bindtap="onTap"'],
    ['weapp', '@tap.passive="onTap"', 'bindtap="onTap"'],
    ['weapp', '@tap.stop.prevent="onTap"', 'catchtap="onTap"'],
    ['weapp', '@click.catch="onTap"', 'catchtap="onTap"'],
    ['weapp', '@overlay-click="onTap"', 'bind:overlay-click="onTap"'],
    ['weapp', '@overlay-click.stop="onTap"', 'catch:overlay-click="onTap"'],
    ['tt', '@tap.stop="onTap"', 'catchtap="onTap"'],
    ['tt', '@tap.catch="onTap"', 'catchtap="onTap"'],
    ['tt', '@overlay-click="onTap"', 'bind:overlay-click="onTap"'],
    ['swan', '@tap.stop="onTap"', 'catchtap="onTap"'],
    ['swan', '@tap.catch="onTap"', 'catchtap="onTap"'],
    ['swan', '@overlay-click="onTap"', 'bind:overlay-click="onTap"'],
    ['alipay', '@tap="onTap"', 'onTap="onTap"'],
    ['alipay', '@tap.stop="onTap"', 'catchTap="onTap"'],
    ['alipay', '@tap.capture.stop="onTap"', 'captureCatchTap="onTap"'],
    ['alipay', '@tap.catch="onTap"', 'catchTap="onTap"'],
    ['alipay', '@tap.capture="onTap"', 'captureTap="onTap"'],
    ['alipay', '@tap.capture.catch="onTap"', 'captureCatchTap="onTap"'],
    ['alipay', '@tap.prevent="onTap"', 'onTap="onTap"'],
    ['alipay', '@tap.once="onTap"', 'onTap="onTap"'],
    ['alipay', '@tap.mut="onTap"', 'onTap="onTap"'],
  ])('maps event modifiers for %s template events: %s', (platform, eventDirective, expectedAttr) => {
    const template = `<view ${eventDirective}>Tap</view>`
    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { platform: getMiniProgramTemplatePlatform(platform as any) },
    )

    expect(code).toContain(expectedAttr)
  })

  it('transforms v-model for input-like elements', () => {
    const template = `
      <input type="checkbox" v-model="checked" />
      <select v-model="selected" />
    `
    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('checked="{{checked}}"')
    expect(code).toContain('value="{{selected}}"')
    expect(code).toContain('bindchange="__weapp_vite_model"')
    expect(code).toContain('data-wv-model="checked"')
    expect(code).toContain('data-wv-model="selected"')
  })

  it('transforms component v-model arguments to matching prop and update event', () => {
    const template = `<UseModelFeature v-model:title="panelTitle" v-model="childModelValue" />`
    const { code, inlineExpressions, warnings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('title="{{panelTitle}}"')
    expect(code).toContain('modelValue="{{childModelValue}}"')
    expect(code).toContain('bind:update-title="__weapp_vite_inline"')
    expect(code).toContain('bind:update-modelvalue="__weapp_vite_inline"')
    expect(code).toContain('data-wd-update-title="1"')
    expect(code).toContain('data-wi-update-title="i0"')
    expect(code).toContain('data-wd-update-modelvalue="1"')
    expect(code).toContain('data-wi-update-modelvalue="i1"')
    expect(inlineExpressions?.[0]?.expression).toContain('ctx.panelTitle=$event')
    expect(inlineExpressions?.[1]?.expression).toContain('ctx.childModelValue=$event')
    expect(warnings).toEqual([])
  })

  it('warns for v-model arguments on native mini-program elements', () => {
    const template = `<input v-model:abc="xyz" />`
    const { code, warnings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('<input />')
    expect(code).not.toContain('value="{{xyz}}"')
    expect(code).not.toContain('data-wv-model="xyz"')
    expect(warnings).toContain('原生小程序元素不支持 v-model 参数，已忽略该 v-model。')
  })

  it('warns for unsupported v-model host while keeping fallback binding', () => {
    const template = `<custom-input v-model="value" />`
    const { code, warnings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('modelValue="{{value}}"')
    expect(code).toContain('bind:update-modelvalue="__weapp_vite_inline"')
    expect(warnings).toEqual([])
  })

  it('treats input as void tag even without explicit self-closing slash', () => {
    const template = `
<view>
  <input class="a" :value="name">
  <view class="b">{{ name }}</view>
</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('<input class="a" value="{{name}}" />')
    expect(code).not.toContain('</input>')
    expect(code).toContain('<view class="b">{{name}}</view>')
  })

  it('handles custom directives with and without expression', () => {
    const withExp = compileVueTemplateToWxml(
      `<view v-track="eventId" />`,
      '/project/src/pages/index/index.vue',
    )
    expect(withExp.code).toContain('data-v-track="{{eventId}}"')

    const withoutExp = compileVueTemplateToWxml(
      `<view v-analytics />`,
      '/project/src/pages/index/index.vue',
    )
    expect(withoutExp.code).toContain('data-v-analytics')
    expect(withoutExp.warnings.some(message => message.includes('v-analytics'))).toBe(true)
  })

  it('transforms keep-alive and transition builtin tags', () => {
    const keepAlive = compileVueTemplateToWxml(
      `<keep-alive><view>A</view></keep-alive>`,
      '/project/src/pages/index/index.vue',
    )
    expect(keepAlive.code).toContain('<block data-keep-alive="true">')
    expect(keepAlive.code).toContain('<view>A</view>')

    const transition = compileVueTemplateToWxml(
      `<transition><view>B</view></transition>`,
      '/project/src/pages/index/index.vue',
    )
    expect(transition.code).toContain('<view>B</view>')
    expect(transition.code).not.toContain('<transition')
    expect(transition.warnings.some(message => message.includes('<transition>'))).toBe(true)
  })

  it('normalizes class/style object-array bindings and warns on spread syntax', () => {
    const template = `
<view
  :class="[baseClass, { active: isActive, [dynamicClass]: dynamicEnabled }, ...extraClass]"
  :style="[{ color }, { width: width + 'px', [dynamicKey]: dynamicValue }, ...extraStyle]"
/>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('class="{{__wv_cls_0}}"')
    expect(code).toContain('style="{{__wv_style_0}}"')
  })

  it('handles builtin template attrs and structural directives', () => {
    const namedTemplate = compileVueTemplateToWxml(
      `<template name="x" is="y" data="z"><view>A</view></template>`,
      '/project/src/pages/index/index.vue',
    )
    expect(namedTemplate.code).toContain('<template name="x" is="y" data="z">')

    const forTemplate = compileVueTemplateToWxml(
      `<template v-for="item in list"><view>{{ item }}</view></template>`,
      '/project/src/pages/index/index.vue',
    )
    expect(forTemplate.code).toContain(`${DEFAULT_TEMPLATE_PLATFORM.directives.forAttr}="{{list}}"`)
    expect(forTemplate.code).toContain('<block')

    const conditionalTemplate = compileVueTemplateToWxml(
      `<template v-if="ok"><view>B</view></template>`,
      '/project/src/pages/index/index.vue',
    )
    expect(conditionalTemplate.code).toContain(`${DEFAULT_TEMPLATE_PLATFORM.directives.ifAttr}="{{ok}}"`)
  })

  it('supports dynamic component fallback and :is rendering branches', () => {
    const withoutIs = compileVueTemplateToWxml(
      `<component><view>fallback</view></component>`,
      '/project/src/pages/index/index.vue',
    )
    expect(withoutIs.code).toContain('<component>')
    expect(withoutIs.warnings.some(message => message.includes('<component> 未提供 :is'))).toBe(true)

    const withIs = compileVueTemplateToWxml(
      `<component :is="dynamicComp" :id="'id-1'"><view>slot</view></component>`,
      '/project/src/pages/index/index.vue',
    )
    expect(withIs.code).toContain('data-is="{{dynamicComp}}"')
    expect(withIs.warnings.some(message => message.includes('动态组件使用 data-is 属性'))).toBe(true)
  })

  it('renders transition with multi-children passthrough', () => {
    const result = compileVueTemplateToWxml(
      `<transition><view>A</view><view>B</view></transition>`,
      '/project/src/pages/index/index.vue',
    )

    expect(result.code).toContain('<view>A</view>')
    expect(result.code).toContain('<view>B</view>')
    expect(result.warnings.some(message => message.includes('<transition>'))).toBe(true)
  })
})
