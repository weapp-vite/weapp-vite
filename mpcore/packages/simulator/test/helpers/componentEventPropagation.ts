export const componentEventPropagationFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.json', '{"usingComponents":{"signal-boundary":"/components/boundary"}}'],
  ['pages/index/index.js', `Page({
    data: { visible: true, pageCount: 0, pageValue: 0 },
    onPageSignal(event) {
      this.setData({ pageCount: this.data.pageCount + 1, pageValue: event.detail.value })
    },
  })`],
  ['pages/index/index.wxml', `
    <signal-boundary wx:if="{{visible}}" id="boundary" bind:signal="onPageSignal"/>
    <text id="page-result">{{pageCount}}/{{pageValue}}</text>
  `],
  ['components/boundary.json', '{"component":true,"usingComponents":{"signal-probe":"/components/probe"}}'],
  ['components/boundary.js', `Component({
    data: { events: [], trace: '', value: 0, source: '' },
    methods: {
      record(phase, event) {
        const events = [...this.data.events, {
          phase,
          detail: event.detail,
          target: event.target,
          currentTarget: event.currentTarget,
        }]
        this.setData({
          events,
          trace: events.map(entry => entry.phase).join(','),
          value: event.detail.value,
          source: event.target.id,
        })
      },
      onCapture(event) { this.record('capture', event) },
      onDirect(event) { this.record('direct', event) },
      onBubble(event) { this.record('bubble', event) },
      onCatch(event) { this.record('catch', event) },
      onCaptureCatch(event) { this.record('capture-catch', event) },
      reset() { this.setData({ events: [], trace: '', value: 0, source: '' }) },
    },
  })`],
  ['components/boundary.wxml', `
    <view>
      <view id="capture-view" data-listener="capture" capture-bind:signal="onCapture">
        <view id="bubble-view" data-listener="bubble" bind:signal="onBubble">
          <signal-probe id="source-host" data-source="probe" bind:signal="onDirect"/>
          <signal-probe id="catch-host" data-source="probe" catch:signal="onCatch"/>
          <signal-probe id="capture-catch-host" data-source="probe" capture-catch:signal="onCaptureCatch"/>
        </view>
      </view>
      <button id="reset-signal" bindtap="reset">reset</button>
      <text id="signal-trace">{{trace}}</text>
      <text id="signal-result">{{value}}/{{source}}</text>
    </view>
  `],
  ['components/probe.json', '{"component":true}'],
  ['components/probe.js', `Component({
    methods: {
      emitPrivate() {
        this.triggerEvent('signal', { value: 11 })
      },
      emitCapture() {
        this.triggerEvent('signal', { value: 19 }, { capturePhase: true })
      },
      emitLocal() {
        this.triggerEvent('signal', { value: 23 }, { bubbles: true, composed: false, capturePhase: true })
      },
      emitPublic() {
        this.triggerEvent('signal', { value: 37 }, { bubbles: true, composed: true, capturePhase: true })
      },
    },
  })`],
  ['components/probe.wxml', `
    <view data-internal="template">
      <button id="emit-local" bindtap="emitLocal">local</button>
      <button id="emit-private" bindtap="emitPrivate">private</button>
      <button id="emit-capture" bindtap="emitCapture">capture only</button>
      <button id="emit-public" bindtap="emitPublic">public</button>
    </view>
  `],
]
