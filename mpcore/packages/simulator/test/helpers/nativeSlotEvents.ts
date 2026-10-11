export const nativeSlotEventFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.json', '{"usingComponents":{"context-host":"/components/host","context-leaf":"/components/leaf"}}'],
  ['pages/index/index.js', `Page({
    data: { visible: true, seed: 0 },
    toggle() { this.setData({ visible: !this.data.visible, seed: 40 }) },
  })`],
  ['pages/index/index.wxml', `
    <view>
      <context-host wx:if="{{visible}}" label="left" seed="{{seed}}"><context-leaf label="left"/></context-host>
      <context-host label="right" seed="10"><view><context-leaf label="right"/></view></context-host>
      <context-host label="outer" seed="100">
        <context-host label="inner" seed="200" internal="{{true}}"><context-leaf slot="named" label="inner"/></context-host>
      </context-host>
      <button id="toggle" bindtap="toggle">toggle</button>
    </view>
  `],
  ['components/host.json', '{"component":true,"usingComponents":{"context-leaf":"/components/leaf"}}'],
  ['components/host.js', `Component({
    behaviors: ['wx://component-export'],
    export() { return { label: this.data.label, increment: () => this.context.increment() } },
    options: { multipleSlots: true },
    properties: { label: String, seed: Number, internal: Boolean },
    data: { count: 0 },
    lifetimes: {
      attached() {
        const ref = { value: this.data.seed }
        const increment = () => { ref.value++; this.setData({ count: ref.value }) }
        this.context = { label: this.data.label, ref, increment }
        this.setData({ count: ref.value })
      },
    },
    methods: {
      resolveContext(event) { event.detail.resolve(this, this.context) },
    },
  })`],
  ['components/host.wxml', `
    <text id="host-{{label}}">{{count}}</text>
    <context-leaf wx:if="{{internal}}" label="{{label}}-internal" bind:contextlink="resolveContext"/>
    <slot bind:contextlink="resolveContext"/>
    <slot name="named" bind:contextlink="resolveContext"/>
  `],
  ['components/leaf.json', '{"component":true}'],
  ['components/leaf.js', `Component({
    properties: { label: String },
    data: { owner: 'missing', count: -1, same: false },
    lifetimes: {
      attached() {
        let host
        let context
        this.triggerEvent('contextlink', {
          resolve(parent, value) { if (!host) { host = parent; context = value } },
        }, { bubbles: true, composed: true })
        this.context = context
        this.ref = context && context.ref
        this.increment = context && context.increment
        const selected = this.selectOwnerComponent()
        this.setData({
          owner: context ? context.label : 'missing',
          count: context ? context.ref.value : -1,
          same: !!host && context === host.context && this.ref === host.context.ref && this.increment === host.context.increment,
          exportKeys: selected ? Object.keys(selected).sort().join(',') : '',
        })
      },
    },
    methods: {
      activate() {
        this.increment()
        this.setData({ count: this.ref.value })
      },
    },
  })`],
  ['components/leaf.wxml', '<button id="leaf-{{label}}" bindtap="activate">{{owner}}/{{count}}/{{same}}</button><text id="export-{{label}}">{{exportKeys}}</text>'],
]
