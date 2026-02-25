import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml, getMiniProgramTemplatePlatform } from './template'

describe('compileVueTemplateToWxml', () => {
  it('rewrites nullish coalescing in bindings', () => {
    const template = `
<t-icon :name="item.icon ?? 'app'" />
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/components/QuickActionGrid/index.vue')

    const normalized = code.replace(/\s/g, '')
    expect(normalized).toContain(`name="{{item.icon!=null?item.icon:'app'}}"`)
    expect(code).not.toContain('??')
  })

  it('rewrites optional chaining in template expressions', () => {
    const template = `
<view :title="routeMeta?.title || '首页'">{{ routeMeta?.group || '模块' }}</view>
<view v-if="scene?.kpis">{{ scene?.summary }}</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/components/RetailPageShell/index.vue')
    const normalized = code.replace(/\s/g, '')

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

    const normalized = code.replace(/\s/g, '')
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

    expect(code).toMatch(/prop="\{\{\s*\{[^}]+\}\s*\}\}"/)
    expect(code).not.toContain('prop="{{{')
    expect(classStyleBindings).toBeUndefined()
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
    const normalized = code.replace(/\s/g, '')

    expect(normalized).toContain('title="{{__wv_bind_0}}"')
    expect(normalized).toContain('>{{__wv_bind_1}}</view>')
    expect(classStyleBindings?.filter(binding => binding.exp === 'sayHello()')).toHaveLength(2)
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

    expect(code).toMatch(/data-title="\{\{__wv_bind_\d+\}\}"/)
    expect(code).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(code).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(code).toMatch(/\{\{__wv_bind_\d+\[[^\]]+\]\}\}/)
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
    ['tt', '@tap.stop="onTap"', 'catchtap="onTap"'],
    ['tt', '@tap.catch="onTap"', 'catchtap="onTap"'],
    ['swan', '@tap.stop="onTap"', 'catchtap="onTap"'],
    ['swan', '@tap.catch="onTap"', 'catchtap="onTap"'],
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
})
