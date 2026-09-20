export const instancePropertiesFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.json', '{"usingComponents":{"property-card":"/components/card"}}'],
  ['pages/index/index.js', `Page({
    data: { parentCount: 2, pageValue: 'initial', nested: { value: 'page-initial' }, pageSummary: '' },
    refreshSummary() {
      this.setData({ pageSummary: this.properties.pageValue + '/' + this.properties.nested.value + '/' + this.properties.added })
    },
  })`],
  ['pages/index/index.wxml', '<view id="page-summary">{{pageSummary}}</view><property-card id="card" count="{{parentCount}}"/>'],
  ['components/card.json', '{"component":true}'],
  ['components/card.js', `Component({
    properties: { count: { type: Number, observer: 'onCount' } },
    data: { ownLabel: 'local', nested: { value: 'component-initial' }, propertySummary: '', observerSummary: '' },
    methods: {
      onCount(next, previous) { this.setData({ observerSummary: String(previous) + '>' + next }) },
      refreshSummary() {
        this.setData({ propertySummary: this.properties.ownLabel + '/' + this.properties.nested.value + '/' + this.properties.added + '/' + this.properties.count })
      },
    },
  })`],
  ['components/card.wxml', '<view id="component-summary">{{propertySummary}}</view><view id="observer-summary">{{observerSummary}}</view>'],
]
