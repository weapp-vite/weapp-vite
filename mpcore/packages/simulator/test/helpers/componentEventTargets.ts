export const componentEventTargetFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.json', '{"usingComponents":{"dialog-box":"/components/dialog"}}'],
  ['pages/index/index.js', `Page({
    data: { lastKind: 'idle', lastHost: '', lastNative: '', result: null },
    receive(event) {
      const result = event.detail
      this.setData({ lastKind: result.kind, lastHost: result.target.id, lastNative: result.nativeTarget.id, result })
    },
  })`],
  ['pages/index/index.wxml', '<dialog-box bind:result="receive"/><text id="result">{{lastKind}}/{{lastHost}}/{{lastNative}}</text>'],
  ['components/dialog.json', '{"component":true,"usingComponents":{"event-button":"/components/button"}}'],
  ['components/dialog.js', `Component({
    data: { _cancel: { bindtap: 'cancel' }, _confirm: { bindtap: 'confirm' } },
    methods: {
      onButton(event) {
        const action = this.data['_' + event.target.dataset.type]
        this.triggerEvent('result', {
          kind: action.bindtap,
          target: event.target,
          currentTarget: event.currentTarget,
          nativeTarget: event.detail.target,
        })
      },
    },
  })`],
  ['components/dialog.wxml', '<event-button id="cancel-host" data-type="cancel" kind="cancel" bind:tap="onButton"/><event-button id="confirm-host" data-type="confirm" kind="confirm" bind:tap="onButton"/>'],
  ['components/button.json', '{"component":true}'],
  ['components/button.js', `Component({
    properties: { kind: String },
    methods: { handleTap(event) { this.triggerEvent('tap', event) } },
  })`],
  ['components/button.wxml', '<button id="{{kind}}-native" data-native="{{kind}}" bindtap="handleTap">{{kind}}</button>'],
]
