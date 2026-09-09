export const styleBindingFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.js', `Page({
    data: { label: 'Base', classes: 'probe', style: 'color:rgb(31, 26, 63);border-radius:18rpx;font-size:24rpx;' },
    activate() {
      this.setData({ label: 'All On', classes: 'probe active ghost', style: 'color:rgb(185, 28, 28);border-radius:999rpx;font-size:26rpx;' })
    },
    reset() {
      this.setData({ label: 'Base', classes: 'probe', style: 'color:rgb(31, 26, 63);border-radius:18rpx;font-size:24rpx;' })
    }
  })`],
  ['pages/index/index.wxml', '<view id="style-probe" class="{{classes}}" style="{{style}}"><text>{{label}}</text></view>'],
]
