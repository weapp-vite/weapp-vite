import { createTemplate, defineComponent, ensureNativeComponentsDefined, initializePageRoutes, setupRpx } from '@weapp-vite/web/runtime'
import { fixture } from './fixtureConfig'

initializePageRoutes([], {
  styleUnits: fixture.styleUnits,
  runtime: { viewport: { mode: 'mini-program', maxWidth: 400, desktopBreakpoint: 800 } },
})
if (fixture.rpx) {
  setupRpx(fixture.rpx)
}
ensureNativeComponentsDefined()
defineComponent('inline-style-legacy-fixture', {
  template: createTemplate(`
    <view id="probe" style="{{styleValue}}">Inline string</view>
    <view id="array" style="{{arrayValue}}">Inline array</view>
    <button id="replace" bindtap="replace">Replace styles</button>
    <button id="clear" bindtap="clear">Clear styles</button>
    <button id="restore" bindtap="restore">Restore styles</button>
  `),
  component: {
    data: { styleValue: 'height:200rpx;width:50vw', arrayValue: [{ width: '40rpx' }, 'height:80rpx'] },
    methods: {
      replace() { this.setData({ styleValue: 'height:400rpx;width:50vw', arrayValue: [{ width: '80rpx' }, 'height:160rpx'] }) },
      clear() { this.setData({ styleValue: null, arrayValue: [] }) },
      restore() { this.setData({ styleValue: 'height:100rpx;width:25vw', arrayValue: [{ width: '40rpx' }, 'height:80rpx'] }) },
    },
  },
})
document.body.append(document.createElement('inline-style-legacy-fixture'))
