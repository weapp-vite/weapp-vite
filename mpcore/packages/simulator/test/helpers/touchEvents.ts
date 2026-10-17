export const touchEventFiles: Array<[string, string]> = [
  ['project.config.json', '{"miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.json', '{"usingComponents":{"touch-card":"/components/card"}}'],
  ['pages/index/index.js', `Page({
    data: { events: [], lastType: 'idle' },
    receive(event) {
      this.setData({ events: this.data.events.concat([event]), lastType: event.type })
    },
  })`],
  ['pages/index/index.wxml', '<view id="touch" data-kind="page" bindtouchstart="receive" bindtouchmove="receive" bindtouchend="receive">Touch</view><touch-card id="card"/><text id="last-type">{{lastType}}</text>'],
  ['components/card.json', '{"component":true}'],
  ['components/card.js', `Component({
    data: { events: [], lastType: 'idle' },
    methods: {
      receive(event) { this.setData({ events: this.data.events.concat([event]), lastType: event.type }) },
    },
  })`],
  ['components/card.wxml', '<view id="component-touch" data-kind="component" bindtouchstart="receive" bindtouchmove="receive" bindtouchend="receive">{{lastType}}</view>'],
]

export const touchPoint = { identifier: 7, pageX: 40, pageY: 60, clientX: 30, clientY: 50 }
