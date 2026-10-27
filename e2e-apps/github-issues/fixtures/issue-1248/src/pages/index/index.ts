import { initializePublicUnits } from '../../shared/publicInitialization'

Page({
  data: { styleValue: 'height:200rpx;width:50vw' as string | null, arrayValue: [{ width: '40rpx' }, 'height:80rpx'] },
  replace() {
    this.setData({ styleValue: 'height:400rpx;width:50vw', arrayValue: [{ width: '80rpx' }, 'height:160rpx'] })
  },
  clear() {
    this.setData({ styleValue: null, arrayValue: [] })
  },
  restore() {
    this.setData({ styleValue: 'height:100rpx;width:25vw', arrayValue: [{ width: '40rpx' }, 'height:80rpx'] })
  },
  legacyUnits() {
    this.setData(initializePublicUnits('legacy', ['pages/index/index']))
  },
  explicitUnits() {
    this.setData(initializePublicUnits('explicit', ['pages/index/index']))
  },
  resetUnits() {
    this.setData(initializePublicUnits('reset', ['pages/index/index']))
  },
})
