export const unprojectedSlotFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({ events: [] })'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { host: '/components/host', leaf: '/components/leaf' } })],
  ['pages/index/index.js', `Page({
    data: { open: false, show: true, rows: [{ id: 1, label: 'one' }, { id: 'a/b', label: 'two' }, { id: 'a', label: 'three' }] },
    reports: [],
    onReadyLeaf(event) { this.reports.push(event.detail) },
    readEvents() { return getApp().events },
    findLeaf(label) { return this.selectComponent('#leaf-' + label) }
  })`],
  ['pages/index/index.wxml', `<host open="{{open}}">
    <leaf wx:if="{{show}}" wx:for="{{rows}}" wx:key="id" id="leaf-{{item.label}}" label="{{item.label}}" bind:ready="onReadyLeaf" />
    <leaf slot="header" id="leaf-header" label="header" bind:ready="onReadyLeaf" />
  </host>`],
  ['components/host.json', JSON.stringify({ component: true })],
  ['components/host.js', 'Component({ options: { multipleSlots: true }, properties: { open: Boolean } })'],
  ['components/host.wxml', '<view wx:if="{{open}}"><slot name="header" /><slot /></view>'],
  ['components/leaf.json', JSON.stringify({ component: true })],
  ['components/leaf.js', `Component({
    properties: { label: String },
    lifetimes: {
      attached() {
        getApp().events.push({ kind: 'attached', label: this.data.label, instance: this });
        this.triggerEvent('ready', { label: this.data.label, instance: this });
      },
      detached() { getApp().events.push({ kind: 'detached', label: this.data.label, instance: this }) }
    }
  })`],
  ['components/leaf.wxml', '<view class="leaf-label">{{label}}</view>'],
]
