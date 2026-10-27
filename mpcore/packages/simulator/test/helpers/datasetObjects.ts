export const datasetObjectFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.json', '{"usingComponents":{"dataset-probe":"/components/dataset-probe/index"}}'],
  ['pages/index/index.js', `Page({
  data: { rows: [{ id: 'same', value: 'pending', nested: { count: 1 } }], event: null, componentEvent: null, selector: null, observer: null },
  capture(event) { this.setData({ event: event.currentTarget.dataset }) },
  captureComponent(event) { this.setData({ componentEvent: event.currentTarget.dataset }) },
  replace() { this.setData({ rows: [{ id: 'same', value: 'complete', nested: { count: 2 } }] }) },
  query() {
    wx.createSelectorQuery().select('#row').fields({ dataset: true }, result => {
      this.setData({ selector: result.dataset })
    }).exec()
  },
  observe() {
    const observer = this.createIntersectionObserver().relativeToViewport()
    observer.observe('#row', result => {
      this.setData({ observer: result.dataset })
      observer.disconnect()
    })
  }
})`],
  ['pages/index/index.wxml', '<view wx:for="{{rows}}" wx:key="id" id="row" data-item="{{item}}" data-item-name="{{item.value}}" data-index="{{index}}" data-enabled="{{false}}" data-literal="0" data-mixed="row-{{index}}" bindtap="capture">row</view><dataset-probe data-item="{{rows[0]}}" data-item-name="{{rows[0].value}}" data-index="{{0}}" data-enabled="{{false}}" data-literal="0" data-mixed="component-{{0}}" bind:select="captureComponent" />'],
  ['components/dataset-probe/index.json', '{"component":true}'],
  ['components/dataset-probe/index.js', 'Component({methods:{select(){this.triggerEvent("select")}}})'],
  ['components/dataset-probe/index.wxml', '<button id="emit" bindtap="select">select</button>'],
]

export function expectedObjectDataset(value = 'pending', count = 1, mixed = 'row-0') {
  return { item: { id: 'same', value, nested: { count } }, itemName: value, index: 0, enabled: false, literal: '0', mixed }
}
