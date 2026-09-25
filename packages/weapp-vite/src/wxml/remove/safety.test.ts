import { describe, expect, it } from 'vitest'
import { getScriptModuleTagNames } from '../../utils/wxmlScriptModule'
import { createWxmlRemover } from './index'

const fileName = 'pages/safety/index.wxml'

describe('WXML cleanup runtime safety', () => {
  it('protects runtime directives, event bindings and generated metadata from broad attribute rules', () => {
    const attrs = [
      'wx:if="{{ok}}"',
      'a:for="{{list}}"',
      'tt:key="id"',
      's-if="ok"',
      's:for="list"',
      'bindtap="tap"',
      'bind:custom-event="custom"',
      'catchtouchmove="move"',
      'capture-bind:tap="tap"',
      'capture-catch:tap="tap"',
      'mut-bind:tap="tap"',
      'onTap="tap"',
      'catchTap="tap"',
      'captureTap="tap"',
      'captureCatchTap="tap"',
      'generic:scoped-slots-item="slot-item"',
      'model:value="{{value}}"',
      'mark:item="1"',
      'change:prop="helper.watch"',
      'data-wv-model="value"',
      'data-wv-s0="{{item}}"',
      'data-wv-i0="{{index}}"',
      'data-wi-tap="i0"',
      'data-wh-tap="tap"',
      'data-wd-tap="1"',
      'data-v-scope=""',
      '__wvSlotOwnerId="owner"',
      '__wvSlotProps="props"',
      'vue-slots="{{slots}}"',
      'slot="header"',
      'data-is="{{component}}"',
    ].join(' ')
    const code = `<my-card ${attrs} debug-prop="gone" data-test="gone"/>`
    expect(createWxmlRemover({ attr: ['*'] })(code, fileName)).toBe(`<my-card ${attrs}  />`)
  })

  it('does not allow exact attribute rules to remove protected bindings', () => {
    const code = '<view wx:if="{{ok}}" bindtap="tap" data-wi-tap="i0"/>'
    expect(createWxmlRemover({ attr: ['wx:if', 'bindtap', 'data-wi-tap'] })(code, fileName)).toBe(code)
  })

  it('preserves legacy word-character event names and native event families under wildcard and exact rules', () => {
    const names = [
      'bind_ready',
      'bind1ready',
      'catch_ready',
      'capture-bind1ready',
      'capture-catch_ready',
      'mut-bind1ready',
      'capture-mut-bind:_ready',
      'capture-mut-bind1ready',
      'bind:custom-event',
      'onReady',
      'captureCatchReady',
    ]
    const code = `<my-card ${names.map(name => `${name}="onReady"`).join(' ')}/>`
    expect(createWxmlRemover({ attr: ['*'] })(code, fileName)).toBe(code)
    expect(createWxmlRemover({ attr: names })(code, fileName)).toBe(code)
  })

  it('preserves native local-variable and dynamic-slot bindings even under exact rules', () => {
    const code = '<block let:student="{{school.student}}"><my-list><view slot:item slot:listIndex="i">{{student.name}} {{item.name}} {{i}}</view></my-list></block>'
    expect(createWxmlRemover({ attr: ['*'] })(code, fileName)).toBe(code)
    expect(createWxmlRemover({ attr: ['let:student', 'slot:item', 'slot:listIndex'] })(code, fileName)).toBe(code)
  })

  it('preserves worklet gesture callbacks against wildcard and exact removal', () => {
    const code = '<pan-gesture-handler worklet:ongesture="onPan" worklet:should-response-on-move="shouldMove" worklet:should-accept-gesture="shouldAccept"><view/></pan-gesture-handler>'
    expect(createWxmlRemover({ attr: ['*'] })(code, fileName)).toBe(code)
    expect(createWxmlRemover({ attr: ['worklet:ongesture', 'worklet:should-response-on-move', 'worklet:should-accept-gesture'] })(code, fileName)).toBe(code)
  })

  it('keeps compiler-owned class/style bindings, ref selectors and layout host ids', () => {
    const code = '<view class="ordinary __wv-ref-0" style="{{__wv_style_0}}" id="__wv-layout-host-0"/><view class="{{__weapp_vite.normalizeClass(classes)}}"/><view class:__wv-ref-0 class:active="{{__wv_class_0}}" style:display="{{__wv_style_0}}"/>'
    expect(createWxmlRemover({ attr: ['*'] })(code, fileName)).toBe(code)
    expect(createWxmlRemover({ attr: ['class', 'style', 'id', 'class:__wv-ref-0', 'class:active', 'style:display'] })(code, fileName)).toBe(code)
  })

  it('conservatively preserves unmarked host attributes against wildcards', () => {
    const code = '<input id="field" class="field" style="{{visible ? \'\' : \'display:none\'}}" hidden="{{hidden}}" value="{{value}}" checked="{{checked}}" slot="body" is="{{host}}" debug="gone"/>'
    expect(createWxmlRemover({ attr: ['*'] })(code, fileName))
      .toBe('<input id="field" class="field" style="{{visible ? \'\' : \'display:none\'}}" hidden="{{hidden}}" value="{{value}}" checked="{{checked}}" slot="body" is="{{host}}" />')
  })

  it('protects ordinary and glass-easel class/style spellings equally against wildcards', () => {
    const code = '<view class="active" style="color:red"/><view class:active style:color="{{color}}" style:display="{{visible ? \'block\' : \'none\'}}"/>'
    expect(createWxmlRemover({ attr: ['*'] })(code, fileName)).toBe(code)
    expect(createWxmlRemover({ attr: ['class*', 'style*'] })(code, fileName)).toBe(code)
  })

  it('allows exact ordinary host-attribute rules to union with broad cleanup', () => {
    const code = '<view style="color:red" class="keep"/><my-card style="color:blue" class="keep"/>'
    expect(createWxmlRemover({ attr: ['*', { tag: 'view', name: 'style' }] })(code, fileName))
      .toBe('<view  class="keep"/><my-card style="color:blue" class="keep"/>')
    expect(createWxmlRemover({ attr: ['style'] })(code, fileName))
      .toBe('<view  class="keep"/><my-card  class="keep"/>')
  })

  it('allows exact ordinary class/style namespace rules without weakening wildcard protection', () => {
    const code = '<view class:active style:color="red"/><my-card class:active style:color="blue"/>'
    expect(createWxmlRemover({ attr: ['class:active', 'style:color'] })(code, fileName))
      .toBe('<view  /><my-card  />')
    expect(createWxmlRemover({ attr: ['*', { tag: 'view', name: 'class:active' }] })(code, fileName))
      .toBe('<view  style:color="red"/><my-card class:active style:color="blue"/>')
  })

  it('keeps ordinary custom props and dataset namespaces intentionally removable', () => {
    const code = '<my-card let-label="debug" class-name="{{__wv_bind_0}}" slot-prop="debug" data:debug="debug"/>'
    expect(createWxmlRemover({ attr: ['*'] })(code, fileName)).toBe('<my-card    />')
    expect(createWxmlRemover({ attr: ['let-label', 'class-name', 'slot-prop', 'data:debug'] })(code, fileName))
      .toBe('<my-card    />')
  })

  it('protects semantic attributes of modules, imports, templates and slots', () => {
    const code = '<wxs module="helper" src="./helper.wxs"/><import-sjs name="helper" from="./helper.sjs"/><import src="./other.wxml"/><include src="./partial.wxml"/><template name="row"><slot name="header"/></template><template is="row" data="{{row}}"/>'
    expect(createWxmlRemover({ attr: ['*'] })(code, fileName)).toBe(code)
  })

  it.each(['block', 'slot', 'template', 'import', 'include', ...getScriptModuleTagNames()])('rejects explicit removal of structural <%s> with source guidance', (tag) => {
    const remove = createWxmlRemover({ tag: [tag] })
    const run = () => remove(`\r\n  <${tag}/>`, fileName)
    expect(run).toThrow('pages/safety/index.wxml:2:3:')
    expect(run).toThrow('#ifdef/#endif')
  })

  it('rejects wildcard matches of protected tags, even beneath another removed node', () => {
    expect(() => createWxmlRemover({ tag: ['*'] })('<debug><block/></debug>', fileName))
      .toThrow('pages/safety/index.wxml:1:8:')
  })

  it.each(['wx:', 'a:', 'tt:', 's:', 's-'])('rejects removal of a preceding %sif that would orphan later branches', (prefix) => {
    const source = `<debug ${prefix}if="{{ok}}"/>\n  <view ${prefix}else/>`
    expect(() => createWxmlRemover({ tag: ['debug'] })(source, fileName))
      .toThrow('pages/safety/index.wxml:2:9:')
  })

  it('rejects removing an intermediate branch that changes a surviving else path', () => {
    const code = '<view wx:if="{{a}}"/><!-- chain --><debug wx:elif="{{b}}"/><view wx:else/>'
    expect(() => createWxmlRemover({ tag: ['debug'], comment: true })(code, fileName))
      .toThrow(/source conditional compilation/)
  })

  it('tracks deleted branches through multiple removed elif nodes', () => {
    const code = '<debug wx:if="{{a}}"/><debug wx:elif="{{b}}"/><view wx:elif="{{c}}"/>'
    expect(() => createWxmlRemover({ tag: ['debug'] })(code, fileName))
      .toThrow(/source conditional compilation/)
  })

  it('allows deleting an entire chain, its enclosing subtree, or only trailing branches', () => {
    const remove = createWxmlRemover({ tag: ['debug', 'debug-box'] })
    expect(remove('<debug wx:if="{{a}}"/><debug wx:else/><view/>', fileName)).toBe('<view/>')
    expect(remove('<debug-box><debug wx:if="{{a}}"/><view wx:else/></debug-box><view/>', fileName)).toBe('<view/>')
    expect(remove('<view wx:if="{{a}}"/><debug wx:elif="{{b}}"/><debug wx:else/>', fileName))
      .toBe('<view wx:if="{{a}}"/>')
  })

  it('does not confuse nested chains or unrelated following if branches', () => {
    const code = '<debug wx:if="{{a}}"/><view wx:if="{{b}}"><debug/><text wx:if="{{c}}"/><text wx:else/></view><view wx:else/>'
    expect(createWxmlRemover({ tag: ['debug'] })(code, fileName))
      .toBe('<view wx:if="{{b}}"><text wx:if="{{c}}"/><text wx:else/></view><view wx:else/>')
  })
})
