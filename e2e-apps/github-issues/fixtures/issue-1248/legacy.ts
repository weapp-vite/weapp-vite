import { createTemplate, defineComponent, ensureNativeComponentsDefined, initializePageRoutes, setupRpx } from '@weapp-vite/web/runtime'
import { fixture } from './fixtureConfig'
import { initializePublicUnits } from './src/shared/publicInitialization'

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
    <button id="legacy-units" bindtap="legacyUnits">Use legacy rpx options</button>
    <button id="explicit-units" bindtap="explicitUnits">Use explicit style units</button>
    <button id="reset-units" bindtap="resetUnits">Reset style units</button>
  `),
  component: {
    data: { styleValue: 'height:200rpx;width:50vw', arrayValue: [{ width: '40rpx' }, 'height:80rpx'] },
    methods: {
      replace() { this.setData({ styleValue: 'height:400rpx;width:50vw', arrayValue: [{ width: '80rpx' }, 'height:160rpx'] }) },
      clear() { this.setData({ styleValue: null, arrayValue: [] }) },
      restore() { this.setData({ styleValue: 'height:100rpx;width:25vw', arrayValue: [{ width: '40rpx' }, 'height:80rpx'] }) },
      legacyUnits() { this.setData(initializePublicUnits('legacy', [])) },
      explicitUnits() { this.setData(initializePublicUnits('explicit', [])) },
      resetUnits() { this.setData(initializePublicUnits('reset', [])) },
    },
  },
})
document.body.append(document.createElement('inline-style-legacy-fixture'))
