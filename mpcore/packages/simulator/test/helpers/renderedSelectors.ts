export function renderedSelectorsFiles(): Array<[string, string]> {
  return [
    ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.json', '{"usingComponents":{"emitter":"/components/emitter"}}'],
    ['pages/index/index.js', `Page({
      data: { records: [], count: 0, nativeResult: 'idle' },
      receive(event) {
        const count = this.data.count + 1
        this.setData({ count, records: [{ label: event.detail.label + count }, ...this.data.records] })
      },
      receiveNative(event) {
        this.setData({ nativeResult: event.detail.type + ':' + typeof event.detail.detail + ':' + typeof event.detail.timeStamp })
      },
    })`],
    ['pages/index/index.wxml', `
<emitter bindresult="receive" bindnative="receiveNative" />
<text id="native-result">{{nativeResult}}</text>
<view wx:for="{{records}}" wx:key="label" id="{{'emit-record-' + index}}" class="emit-record">
  <text class="emit-label">{{item.label}}</text>
</view>`],
    ['components/emitter.json', '{"component":true}'],
    ['components/emitter.js', `Component({ methods: {
      emitPayload() { this.triggerEvent('result', { label: 'payload-' }) },
      emitNative(event) { this.triggerEvent('native', event) },
    } })`],
    ['components/emitter.wxml', '<button id="emit-direct-payload" bindtap="emitPayload">emit payload</button><button id="emit-native" bindtap="emitNative">emit native</button>'],
  ]
}
