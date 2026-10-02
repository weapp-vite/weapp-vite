import { createTemplate, defineComponent, ensureNativeComponentsDefined, registerApp } from '@weapp-vite/web/runtime'

ensureNativeComponentsDefined()

defineComponent('event-source-probe', {
  template: createTemplate(`
    <button id="emit-click" bindtap="click">Emit one click</button>
    <button id="emit-case" bindtap="caseEvent">Emit exact case</button>
    <button id="native-only">Native gesture only</button>
    <button id="emit-local" bindtap="localSignal">Local signal</button>
    <button id="emit-public" bindtap="publicSignal">Public signal</button>
    <textarea id="nested-input" bindinput="input" />
  `),
  component: {
    options: { styleIsolation: 'apply-shared' },
    methods: {
      click() { this.triggerEvent('click') },
      caseEvent() { this.triggerEvent('onReady', { message: 'legacy-detail', count: 7 }) },
      input(event) { this.triggerEvent('input', { value: event.detail.value, source: 'component' }) },
      localSignal() { this.triggerEvent('signal', { value: 23 }, { bubbles: true, composed: false }) },
      publicSignal() { this.triggerEvent('signal', { value: 37 }, { bubbles: true, composed: true }) },
    },
  },
})

defineComponent('event-boundary-probe', {
  template: createTemplate(`
    <view capture-bind:signal="capture">
      <view bind:signal="bubble">
        <event-source-probe id="source" bindclick="click" bindtap="tap" bind:onReady="ready" bind:onready="lower" bindinput="input" bind:signal="direct" />
        <event-source-probe id="caught" catch:signal="caught" />
        <event-source-probe id="capture-caught" capture-catch:signal="captureCaught" />
      </view>
    </view>
    <view bindtap="nativeAncestor">
      <event-source-probe id="filtered-catch" capture-catch:click="click" />
    </view>
    <button id="native-tap" bindtap="tap">Native tap</button>
    <button id="native-click" bindclick="nativeClick">Native click</button>
    <button id="register-late" bindtap="registerLate">Register late component</button>
    <event-late-probe id="late-source" bindclick="lateClick" />
    <text id="legacy-late-count">{{lateClicks}}</text>
    <text id="legacy-count">{{clicks}}</text>
    <text id="legacy-taps">{{taps}}</text>
    <text id="legacy-native-clicks">{{nativeClicks}}</text>
    <text id="legacy-native-ancestor">{{nativeAncestors}}</text>
    <text id="legacy-detail">{{detail}}</text>
    <text id="legacy-lower">{{lower}}</text>
    <text id="legacy-input-count">{{inputs}}</text>
    <text id="legacy-input-value">{{inputValue}}</text>
    <text id="legacy-trace">{{trace}}</text>
  `),
  component: {
    data: { clicks: 0, taps: 0, nativeClicks: 0, nativeAncestors: 0, detail: '', lower: 0, inputs: 0, inputValue: '', trace: '', lateClicks: 0 },
    methods: {
      registerLate() {
        defineComponent('event-late-probe', {
          template: createTemplate('<button id="emit-late" bindtap="click">Late component click</button>'),
          component: { methods: { click() { this.triggerEvent('click') } } },
        })
      },
      lateClick() { this.setData({ lateClicks: this.data.lateClicks + 1 }) },
      click() { this.setData({ clicks: this.data.clicks + 1 }) },
      tap() { this.setData({ taps: this.data.taps + 1 }) },
      nativeClick() { this.setData({ nativeClicks: this.data.nativeClicks + 1 }) },
      nativeAncestor() { this.setData({ nativeAncestors: this.data.nativeAncestors + 1 }) },
      ready(event) { this.setData({ detail: `${event.type}:${event.detail.message}:${event.detail.count}` }) },
      lower() { this.setData({ lower: this.data.lower + 1 }) },
      input(event) { this.setData({ inputs: this.data.inputs + 1, inputValue: `${event.detail.source}:${event.detail.value}` }) },
      capture() { this.setData({ trace: 'capture' }) },
      direct() { this.setData({ trace: `${this.data.trace},direct` }) },
      bubble() { this.setData({ trace: `${this.data.trace},bubble` }) },
      caught() { this.setData({ trace: `${this.data.trace},catch` }) },
      captureCaught() { this.setData({ trace: `${this.data.trace},capture-catch` }) },
    },
  },
})

let fixture: HTMLElement

defineComponent('event-legacy-fixture', {
  template: createTemplate(`
    <event-boundary-probe bind:signal="signal" />
    <text id="legacy-outer">0</text>
    <text id="legacy-outer-detail">0</text>
  `),
  component: {
    methods: {
      signal(event) {
        // 保持 legacy 子树实例，单独展示跨 Shadow DOM 的接收结果。
        const count = fixture.shadowRoot!.querySelector('#legacy-outer')!
        count.textContent = String(Number(count.textContent) + 1)
        fixture.shadowRoot!.querySelector('#legacy-outer-detail')!.textContent = String(event.detail.value)
      },
    },
  },
})

fixture = document.createElement('event-legacy-fixture')
document.body.append(fixture)

const styles = ['#emit-click { color: rgb(231, 17, 83) }', '', '#emit-click { color: rgb(41, 73, 191) }']
let styleIndex = 0
const styleControl = document.createElement('button')
styleControl.id = 'legacy-style-update'
styleControl.textContent = 'Cycle application style'
styleControl.addEventListener('click', () => {
  registerApp({}, { id: 'legacy-app', style: styles[styleIndex++ % styles.length] })
})
document.body.prepend(styleControl)
