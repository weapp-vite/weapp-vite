import { createTemplate, defineComponent, ensureNativeComponentsDefined } from '@weapp-vite/web/runtime'

ensureNativeComponentsDefined()
defineComponent('dataset-probe', {
  template: createTemplate('<button id="emit-select" bindtap="select">Emit component selection</button>'),
  component: { methods: { select() { this.triggerEvent('select', { selected: true }) } } },
})
defineComponent('dataset-legacy-fixture', {
  template: createTemplate(`
    <view wx:for="{{rows}}" wx:key="id" id="row-{{index}}" data-item="{{item}}" data-itemName="{{item}}" data-Foo="{{0}}" data-index="{{index}}" data-enabled="{{false}}" data-literal="0" data-item-name="{{item.value}}" bindtap="capture">Select {{index}}</view>
    <dataset-probe id="component-probe" data-item="{{rows[0]}}" data-index="{{rows.length}}" bind:select="capture" />
    <button id="replace" bindtap="replace">Replace object</button>
    <button id="query" bindtap="query">Query dataset</button>
    <button id="observe" bindtap="observe">Observe dataset</button>
    <text id="snapshot">{{snapshot}}</text><text id="selector">{{selector}}</text><text id="observer">{{observer}}</text>
  `),
  component: {
    data: {
      rows: [{ id: 'same', value: 'pending', nested: { count: 1 } }],
      snapshot: '',
      selector: '',
      observer: '',
    },
    methods: {
      capture(event) { this.setData({ snapshot: JSON.stringify(event.currentTarget.dataset) }) },
      replace() { this.setData({ rows: [{ id: 'same', value: 'complete', nested: { count: 2 } }] }) },
      query() {
        this.createSelectorQuery().select('#row-0').fields({ dataset: true }, (result: { dataset: Record<string, unknown> }) => {
          this.setData({ selector: JSON.stringify(result.dataset) })
        }).exec()
      },
      observe() {
        const observer = this.createIntersectionObserver()
        observer.relativeToViewport().observe('#row-0', (result: { dataset: Record<string, unknown> }) => {
          this.setData({ observer: JSON.stringify(result.dataset) })
          observer.disconnect()
        })
      },
    },
  },
})
document.body.append(document.createElement('dataset-legacy-fixture'))
