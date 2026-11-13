export const pureDataFiles: Array<[string, string]> = [
  ['project.config.json', `{"miniprogramRoot":"./"}`],
  ['app.json', `{"pages":["pages/index/index"]}`],
  ['app.js', `App({})`],
  ['pages/index/index.json', `{"usingComponents":{"probe":"/components/probe"}}`],
  ['pages/index/index.js', `Page({})`],
  ['pages/index/index.wxml', `<probe id="probe" _text="incoming" />`],
  ['components/probe.json', `{"component":true}`],
  ['components/probe.js', `Component({
  options: { pureDataPattern: /^_/ },
  data: { visible: 'initial', _private: 'hidden', propertyObserverCalls: 0, dataEvents: [] },
  properties: {
    _text: { type: String, observer() { this.data.propertyObserverCalls++ } },
  },
  observers: {
    _private(value) { this.data.dataEvents.push(value) },
  },
  lifetimes: {
    attached() { this.setData({ visible: 'updated', _private: 'updated-secret' }) },
    ready() {
      this.snapshot = {
        logic: this.data._private,
        property: this.data._text,
        propertyObserverCalls: this.data.propertyObserverCalls,
        dataEvents: this.data.dataEvents,
      }
    },
  },
})
`],
  ['components/probe.wxml', `<text id="pure-contract">{{visible}}|{{_private}}|{{_text}}</text>
`],
]

export const pureDataExpectedSnapshot = { logic: 'updated-secret', property: 'incoming', propertyObserverCalls: 0, dataEvents: ['updated-secret'] }
