const componentConfig = JSON.stringify({ component: true })

export const nativeFormFiles: Array<[string, string]> = [
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', `App({
    globalData: { stages: [], events: [], nextPage: 0, nextComponent: 0 },
    onLaunch() { wx.onAppRouteDone(() => this.globalData.stages.push('done')) },
  })`],
  ['pages/index/index.json', JSON.stringify({ usingComponents: {
    'native-form': '/components/native-form',
    'submit-button': '/components/submit-button',
    'private-button': '/components/private-button',
    'plain-slot': '/components/plain-slot',
    'field-group': '/components/field-group',
    'private-field': '/components/private-field',
    'button-shell': '/components/button-shell',
  } })],
  ['pages/index/index.js', `Page({
    data: { visible: true, action: '', inputValue: 'initial', submissions: 0, taps: 0 },
    onLoad() { this.identity = ++getApp().globalData.nextPage },
    onTap(event) {
      getApp().globalData.events.push({ owner: 'page', identity: this.identity, type: event.type, target: event.target.id, currentTarget: event.currentTarget.id })
      this.setData({ taps: this.data.taps + 1 })
      return 'tap-result'
    },
    onAncestor(event) {
      getApp().globalData.events.push({ owner: 'page', identity: this.identity, type: event.type, target: event.target.id, currentTarget: event.currentTarget.id })
    },
    onShellHostTap(event) {
      getApp().globalData.events.push({ owner: 'page-host', type: event.type, target: event.target.id, currentTarget: event.currentTarget.id })
    },
    onInput(event) { this.setData({ inputValue: event.detail.value }) },
    onSubmit(event) {
      getApp().globalData.events.push({ owner: 'page', identity: this.identity, type: event.type, target: event.target.id, currentTarget: event.currentTarget.id, detail: event.detail })
      this.setData({ submissions: this.data.submissions + 1 })
      return 'submit-result'
    },
    onRemove() {
      this.setData({ visible: false })
      if (this.data.action === 'remove-and-render') {
        wx.createSelectorQuery().select('#status').boundingClientRect().exec()
      }
      if (this.data.action === 'reLaunch') {
        wx.reLaunch({ url: '/pages/index/index?replacement=true' })
      }
    },
  })`],
  ['pages/index/index.wxml', `
    <view>
      <text id="status">{{taps}}/{{submissions}}</text>
      <form id="raw-form" data-kind="raw" bindsubmit="onSubmit" bindtap="onAncestor">
        <input id="input" name="text" value="{{inputValue}}" bindinput="onInput" />
        <textarea name="notes" value="memo" />
        <switch name="enabled" checked="{{true}}" />
        <switch name="off" checked="{{false}}" />
        <slider name="amount" value="42" />
        <picker name="choice" value="2"><text>pick</text></picker>
        <picker name="date" mode="date" value="2026-10-12" />
        <picker name="columns" mode="multiSelector" value="{{[1, 2]}}" />
        <picker name="region" mode="region" value="{{['Province, North', 'City', 'District']}}" />
        <radio-group name="radio"><radio value="a" /><view><radio value="b" checked /></view></radio-group>
        <checkbox-group name="checks"><checkbox value="a" checked /><checkbox value="b" /><view><checkbox value="c" checked="{{true}}" /></view></checkbox-group>
        <checkbox-group name="emptyChecks"><checkbox value="no" /></checkbox-group>
        <input value="unnamed" /><view name="notAField" value="ignored" />
        <input name="__proto__" value="safe" />
        <button id="submit" form-type="submit" bindtap="onTap"><text id="nested">send</text></button>
        <button id="disabled" form-type="submit" disabled="{{true}}" bindtap="onTap">disabled</button>
        <button id="enabled-false" form-type="submit" disabled="{{false}}" bindtap="onTap">enabled</button>
        <button id="ordinary" bindtap="onTap">ordinary</button>
        <button id="caught-button" form-type="submit" catchtap="onTap"><text id="caught-child">caught button</text></button>
        <button id="blocked-button" form-type="submit" bindtap="onTap"><text id="blocked-child" catchtap="onTap">caught child</text></button>
        <view id="catch-above" catchtap="onTap"><button id="below-catch" form-type="submit">submit</button></view>
        <form id="inner-form" bindsubmit="onSubmit"><input name="inner" value="only" /><button id="inner-submit" form-type="submit">inner</button></form>
      </form>
      <button id="orphan" form-type="submit" bindtap="onTap">orphan</button>
      <form id="unbound-form"><button id="unbound-submit" form-type="submit">no listener</button></form>
      <form id="boundary-form" bindsubmit="onSubmit">
        <input name="outside" value="public" />
        <private-field />
        <field-group />
        <plain-slot><input name="projected" value="slot value" /><button id="projected-submit" form-type="submit">slot button</button></plain-slot>
        <private-button />
        <submit-button label="direct" />
        <button-shell id="shell-host" bindtap="onShellHostTap" />
      </form>
      <native-form wx:if="{{visible}}" id="wrapped-form" bindremove="onRemove" action="{{action}}">
        <input name="slotted" value="in form slot" />
        <submit-button label="slotted" />
      </native-form>
    </view>
  `],
  ['components/native-form.json', componentConfig],
  ['components/native-form.js', `Component({
    properties: { action: String },
    lifetimes: { created() { this.identity = ++getApp().globalData.nextComponent } },
    methods: {
      onTap() {
        if (this.data.action) this.triggerEvent('remove')
      },
      onSubmit(event) {
        getApp().globalData.events.push({ owner: 'form-component', identity: this.identity, type: event.type, target: event.target.id, currentTarget: event.currentTarget.id, detail: event.detail })
        return 'component-submit-result'
      },
    },
  })`],
  ['components/native-form.wxml', '<form id="component-form" bindtap="onTap" bindsubmit="onSubmit"><slot /></form>'],
  ['components/submit-button.json', componentConfig],
  ['components/submit-button.js', `Component({
    behaviors: [Behavior({ behaviors: ['wx://form-field-button'] })],
    properties: { label: String },
    methods: {
      onTap(event) {
        getApp().globalData.events.push({ owner: 'button-component', type: event.type, target: event.target.id, currentTarget: event.currentTarget.id })
        return 'button-result'
      },
    },
  })`],
  ['components/submit-button.wxml', '<button id="{{label + \'-button\'}}" form-type="submit" bindtap="onTap"><text id="{{label + \'-label\'}}">submit</text></button>'],
  ['components/private-button.json', componentConfig],
  ['components/private-button.js', 'Component({})'],
  ['components/private-button.wxml', '<button id="private-button" form-type="submit">private</button>'],
  ['components/plain-slot.json', componentConfig],
  ['components/plain-slot.js', 'Component({})'],
  ['components/plain-slot.wxml', '<view><slot /></view>'],
  ['components/private-field.json', componentConfig],
  ['components/private-field.js', 'Component({})'],
  ['components/private-field.wxml', '<input name="private" value="must not leak" />'],
  ['components/field-group.json', componentConfig],
  ['components/field-group.js', 'Component({ behaviors: ["wx://form-field-group"] })'],
  ['components/field-group.wxml', '<view><input name="grouped" value="group value" /></view>'],
  ['components/button-shell.json', JSON.stringify({ component: true, usingComponents: { 'submit-button': '/components/submit-button' } })],
  ['components/button-shell.js', `Component({
    methods: {
      onShellTap(event) {
        getApp().globalData.events.push({ owner: 'shell-component', type: event.type, target: event.target.id, currentTarget: event.currentTarget.id })
      },
    },
  })`],
  ['components/button-shell.wxml', '<submit-button id="inner-host" label="encapsulated" bindtap="onShellTap" />'],
]

export const nativeFormValue = {
  text: 'initial',
  notes: 'memo',
  enabled: true,
  off: false,
  amount: 42,
  choice: 2,
  date: '2026-10-12',
  columns: [1, 2],
  region: ['Province, North', 'City', 'District'],
  radio: 'b',
  checks: ['a', 'c'],
  emptyChecks: [],
  ['__proto__']: 'safe',
}
