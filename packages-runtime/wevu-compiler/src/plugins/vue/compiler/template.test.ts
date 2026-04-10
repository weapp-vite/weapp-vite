import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml, getMiniProgramTemplatePlatform } from './template'

const WHITESPACE_RE = /\s/g
const INLINE_OBJECT_PROP_RE = /prop="\{\{\s*\{[^}]+\}\s*\}\}"/
const DATA_TITLE_BIND_RE = /data-title="\{\{__wv_bind_\d+\}\}"/
const IF_BIND_RE = /wx:if="\{\{__wv_bind_\d+\}\}"/
const FOR_BIND_RE = /wx:for="\{\{__wv_bind_\d+\}\}"/
const INTERPOLATION_BIND_INDEX_RE = /\{\{__wv_bind_\d+\[[^\]]+\]\}\}/

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

  it('renders mustache with spaces when interpolation mode is spaced', () => {
    const template = `
<view v-if="ok" :prop="value" :class="dynamicClass" v-show="visible">{{ text }}</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { mustacheInterpolation: 'spaced' },
    )

    expect(code).toContain('wx:if="{{ ok }}"')
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

    expect(code).toContain('wx:if="{{ ok }}"')
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

    expect(code).toContain('<view class="card" bindtap="onTap">')
    expect(code).toContain('<text>{{title}}</text>')
    expect(code).toContain('<image src="{{cover}}" />')
    expect(code).toContain('<navigator url="/pages/detail/index">详情</navigator>')
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

    expect(code).toContain('<scroll-view><view>hello</view></scroll-view>')
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

    expect(code).toContain('<view>')
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

    expect(code).toContain('<text bindtap="onTap">text</text>')
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

    expect(code).toContain('<block wx:if="{{ok}}"><view>')
    expect(code).toContain('<text wx:for="{{list}}" wx:for-item="item"')
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

    expect(code).toContain('<view><view>hello</view><image src="/cover.png" /></view>')
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

    expect(code).toContain('wx:if="{{__wv_bind_0}}"')
    expect(code).toContain('wx:for="{{__wv_bind_1}}"')
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

    expect(code).toContain('wx:for="{{entries}}"')
    expect(code).toContain('wx:for-item="__wv_item_0"')
    expect(code).toContain('wx:for-index="index"')
    expect(code).toContain('wx:key="index"')
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

    expect(code).toContain('wx:for="{{rows}}"')
    expect(code).toContain('wx:for-item="__wv_item_0"')
    expect(code).toContain('wx:for-index="index"')
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

    expect(code).toContain('wx:for="{{summaryMap}}"')
    expect(code).toContain('wx:for-item="value"')
    expect(code).toContain('wx:for-index="key"')
    expect(code).toContain('wx:key="key"')
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

    expect(code).toContain(`__wv-slot-props="{{['item',card.item,'index',card.index]}}"`)
    expect(code).not.toContain(`__wv-slot-props="{{{`)
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

    expect(code).toContain(`__wv-slot-scope="{{['item',item,'index',index]}}"`)
    expect(code).not.toContain(`__wv-slot-scope="{{{`)
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

    const { code, warnings } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { scopedSlotsCompiler: 'off' },
    )

    expect(warnings.some(message => message.includes('已禁用作用域插槽参数'))).toBe(true)
    expect(code).toContain('<view slot="header"><view>{{title}}</view></view>')
    expect(code).toContain('<slot><view>fallback</view></slot>')
    expect(code).not.toContain('vue-slots=')
    expect(code).not.toContain('__wv-slot-props=')
  })

  it.each([
    [
      'weapp',
      {
        ifAttr: 'wx:if',
        elifAttr: 'wx:elif',
        elseAttr: 'wx:else',
        forAttr: 'wx:for',
        keyAttr: 'wx:key',
        eventAttr: 'bindtap',
      },
    ],
    [
      'alipay',
      {
        ifAttr: 'a:if',
        elifAttr: 'a:elif',
        elseAttr: 'a:else',
        forAttr: 'a:for',
        keyAttr: 'a:key',
        eventAttr: 'onTap',
      },
    ],
    [
      'tt',
      {
        ifAttr: 'tt:if',
        elifAttr: 'tt:elif',
        elseAttr: 'tt:else',
        forAttr: 'tt:for',
        keyAttr: 'tt:key',
        eventAttr: 'bindtap',
      },
    ],
    [
      'swan',
      {
        ifAttr: 's-if',
        elifAttr: 's-elif',
        elseAttr: 's-else',
        forAttr: 's-for',
        keyAttr: 's-key',
        eventAttr: 'bindtap',
      },
    ],
    [
      'jd',
      {
        ifAttr: 'wx:if',
        elifAttr: 'wx:elif',
        elseAttr: 'wx:else',
        forAttr: 'wx:for',
        keyAttr: 'wx:key',
        eventAttr: 'bindtap',
      },
    ],
    [
      'xhs',
      {
        ifAttr: 'wx:if',
        elifAttr: 'wx:elif',
        elseAttr: 'wx:else',
        forAttr: 'wx:for',
        keyAttr: 'wx:key',
        eventAttr: 'bindtap',
      },
    ],
  ])('applies platform template attrs for %s', (platform, expected) => {
    const template = `
<view v-if="ok">A</view>
<view v-else-if="other">B</view>
<view v-else>C</view>
<view v-for="(item, index) in list" :key="item.id" @tap="onTap">{{ item.name }}</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { platform: getMiniProgramTemplatePlatform(platform as any) },
    )

    expect(code).toContain(expected.ifAttr)
    expect(code).toContain(expected.elifAttr)
    expect(code).toContain(expected.elseAttr)
    expect(code).toContain(expected.forAttr)
    expect(code).toContain(expected.keyAttr)
    expect(code).toContain(expected.eventAttr)
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
    const template = `<input type="checkbox" v-model="checked" />`
    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('checked="{{checked}}"')
    expect(code).toContain('bindchange="__weapp_vite_model"')
    expect(code).toContain('data-wv-model="checked"')
  })

  it('warns for unsupported v-model host while keeping fallback binding', () => {
    const template = `<custom-input v-model="value" />`
    const { code, warnings } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain('value="{{value}}"')
    expect(code).toContain('bindinput="__weapp_vite_model"')
    expect(warnings.some(message => message.includes('v-model'))).toBe(true)
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
    expect(forTemplate.code).toContain('wx:for="{{list}}"')
    expect(forTemplate.code).toContain('<block')

    const conditionalTemplate = compileVueTemplateToWxml(
      `<template v-if="ok"><view>B</view></template>`,
      '/project/src/pages/index/index.vue',
    )
    expect(conditionalTemplate.code).toContain('wx:if="{{ok}}"')
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
